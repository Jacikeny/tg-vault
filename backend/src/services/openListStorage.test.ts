import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fetchResponseWithBodyTimeout, OpenListRequestError, OpenListStorageProvider } from './openListStorage.js';

interface StoredObject { body: Buffer; contentType: string }

function json(res: http.ServerResponse, status: number, body: unknown) {
    const payload = Buffer.from(JSON.stringify(body));
    res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': payload.length });
    res.end(payload);
}

async function readBody(req: http.IncomingMessage): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
}

function createFixture() {
    const objects = new Map<string, StoredObject>();
    const directories = new Set(['/vault']);
    const calls: Array<{ method: string; url: string; headers: http.IncomingHttpHeaders; body: Buffer }> = [];
    let loginCount = 0;
    let expireFirstGet = false;

    const server = http.createServer(async (req, res) => {
        const body = await readBody(req);
        calls.push({ method: req.method || '', url: req.url || '', headers: req.headers, body });
        if (req.url === '/api/auth/login' && req.method === 'POST') {
            loginCount += 1;
            return json(res, 200, { code: 200, data: { token: `token-${loginCount}` }, message: 'success' });
        }
        if (req.url?.startsWith('/raw/') && (req.method === 'GET' || req.method === 'HEAD')) {
            const target = req.url.slice('/raw'.length);
            const stored = objects.get(target);
            if (!stored) { res.writeHead(404); return res.end(); }
            const match = String(req.headers.range || '').match(/^bytes=(\d+)-(\d+)$/);
            if (match) {
                const start = Number(match[1]);
                const end = Math.min(Number(match[2]), stored.body.length - 1);
                const part = stored.body.subarray(start, end + 1);
                res.writeHead(206, {
                    'Content-Type': stored.contentType,
                    'Content-Length': part.length,
                    'Content-Range': `bytes ${start}-${end}/${stored.body.length}`,
                    'Accept-Ranges': 'bytes',
                });
                return req.method === 'HEAD' ? res.end() : res.end(part);
            }
            res.writeHead(200, { 'Content-Type': stored.contentType, 'Content-Length': stored.body.length, 'Accept-Ranges': 'bytes' });
            return req.method === 'HEAD' ? res.end() : res.end(stored.body);
        }
        if (req.headers.authorization !== `token-${loginCount}`) {
            return json(res, 401, { code: 401, message: 'expired' });
        }
        if (req.url === '/api/fs/get' && req.method === 'POST') {
            if (expireFirstGet) {
                expireFirstGet = false;
                return json(res, 200, { code: 401, message: 'expired' });
            }
            const input = JSON.parse(body.toString('utf8'));
            const target = String(input.path);
            if (directories.has(target)) return json(res, 200, { code: 200, data: { name: path.posix.basename(target), size: 0, is_dir: true }, message: 'success' });
            const stored = objects.get(target);
            if (!stored) return json(res, 200, { code: 500, message: 'object not found' });
            return json(res, 200, {
                code: 200,
                data: { name: path.posix.basename(target), size: stored.body.length, is_dir: false, raw_url: `http://127.0.0.1:${(server.address() as any).port}/raw${target}` },
                message: 'success',
            });
        }
        if (req.url === '/api/fs/mkdir' && req.method === 'POST') {
            directories.add(JSON.parse(body.toString('utf8')).path);
            return json(res, 200, { code: 200, data: null, message: 'success' });
        }
        if (req.url === '/api/fs/put' && req.method === 'PUT') {
            const target = decodeURIComponent(String(req.headers['file-path'] || ''));
            objects.set(target, { body, contentType: String(req.headers['content-type'] || 'application/octet-stream') });
            return json(res, 200, { code: 200, data: null, message: 'success' });
        }
        if (req.url === '/api/fs/remove' && req.method === 'POST') {
            const input = JSON.parse(body.toString('utf8'));
            for (const name of input.names) objects.delete(path.posix.join(input.dir, name));
            return json(res, 200, { code: 200, data: null, message: 'success' });
        }
        res.writeHead(404); res.end();
    });
    return { server, calls, objects, get loginCount() { return loginCount; }, expireTokenOnNextGet() { expireFirstGet = true; } };
}

async function listen(server: http.Server): Promise<string> {
    const port = await new Promise<number>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve((server.address() as any).port));
    });
    return `http://127.0.0.1:${port}`;
}

async function collect(stream: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream as any) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
}

async function readResponseBody(response: Response): Promise<Uint8Array> {
    return new Uint8Array(await response.arrayBuffer());
}

test('body timeout wrapper preserves completed and range responses', async () => {
    const response = await fetchResponseWithBodyTimeout('https://example.test/file', {
        headers: { Range: 'bytes=1-2' },
    }, 100, async (_url, init) => {
        assert.equal(new Headers(init?.headers).get('Range'), 'bytes=1-2');
        return new Response('bc', { status: 206, headers: { 'Content-Range': 'bytes 1-2/4', 'X-Upstream': 'yes' } });
    });
    assert.equal(response.status, 206);
    assert.equal(response.headers.get('Content-Range'), 'bytes 1-2/4');
    assert.equal(response.headers.get('X-Upstream'), 'yes');
    assert.equal(Buffer.from(await readResponseBody(response)).toString('utf8'), 'bc');
});

test('body timeout wrapper fails when headers arrive but the body stalls', async () => {
    let cancelled = false;
    const response = await fetchResponseWithBodyTimeout('https://example.test/stalled', {}, 20, async () => new Response(new ReadableStream({
        pull() { return new Promise(() => undefined); },
        cancel() { cancelled = true; },
    })));
    await assert.rejects(() => response.arrayBuffer(), (error: unknown) => {
        assert.ok(error instanceof OpenListRequestError);
        assert.match(error.message, /超时/);
        return true;
    });
    assert.equal(cancelled, true);
});

test('cancelling the wrapped body cancels the upstream reader and clears the timeout', async () => {
    let cancelled = false;
    const response = await fetchResponseWithBodyTimeout('https://example.test/cancel', {}, 20, async () => new Response(new ReadableStream({
        start(controller) { controller.enqueue(new TextEncoder().encode('a')); },
        pull() { return new Promise(() => undefined); },
        cancel() { cancelled = true; },
    })));
    const reader = response.body!.getReader();
    assert.equal(Buffer.from((await reader.read()).value!).toString('utf8'), 'a');
    await reader.cancel('caller stopped');
    await new Promise(resolve => setTimeout(resolve, 35));
    assert.equal(cancelled, true);
});

test('OpenList native provider uploads with synchronous non-overwrite semantics and verifies the remote object', async () => {
    const fixture = createFixture();
    const address = await listen(fixture.server);
    const dir = await mkdtemp(path.join(os.tmpdir(), 'tg-vault-openlist-'));
    const input = path.join(dir, 'payload.bin');
    const expected = Buffer.from('native OpenList upload');
    await writeFile(input, expected);
    try {
        const provider = new OpenListStorageProvider('account-1', address, 'vault', 'alice', 'secret', undefined, undefined, undefined, fetch);
        await provider.probe();
        const storedPath = await provider.saveFile(input, 'payload.bin', 'application/octet-stream', 'nested/中文');
        assert.equal(storedPath, '/vault/nested/中文/payload.bin');
        assert.deepEqual(fixture.objects.get(storedPath)?.body, expected);
        const put = fixture.calls.find(call => call.url === '/api/fs/put');
        assert.equal(put?.headers['file-path'], encodeURIComponent(storedPath));
        assert.equal(put?.headers['content-length'], String(expected.length));
        assert.equal(put?.headers['as-task'], 'false');
        assert.equal(put?.headers.overwrite, 'false');
        assert.equal(await provider.getFileSize(storedPath), expected.length);
    } finally {
        await new Promise<void>(resolve => fixture.server.close(() => resolve()));
        await rm(dir, { recursive: true, force: true });
    }
});

test('OpenList native provider write probe performs a round trip and cleans its remote object', async () => {
    const fixture = createFixture();
    const address = await listen(fixture.server);
    try {
        const provider = new OpenListStorageProvider('account-1', address, '/vault', 'alice', 'secret', undefined, undefined, undefined, fetch);
        await provider.probeWritable();
        assert.equal(fixture.objects.size, 0);
        assert.ok(fixture.calls.some(call => call.url === '/api/fs/put'));
        assert.ok(fixture.calls.some(call => call.url === '/api/fs/remove'));
    } finally {
        await new Promise<void>(resolve => fixture.server.close(() => resolve()));
    }
});

test('OpenList native provider refreshes an expired login token once', async () => {
    const fixture = createFixture();
    const address = await listen(fixture.server);
    try {
        const provider = new OpenListStorageProvider('account-1', address, '/vault', 'alice', 'secret', undefined, undefined, undefined, fetch);
        await provider.probe();
        fixture.expireTokenOnNextGet();
        await provider.probe();
        assert.equal(fixture.loginCount, 2);
    } finally {
        await new Promise<void>(resolve => fixture.server.close(() => resolve()));
    }
});

test('OpenList native provider proxies byte ranges and keeps internal compensation deletion', async () => {
    const fixture = createFixture();
    const address = await listen(fixture.server);
    const dir = await mkdtemp(path.join(os.tmpdir(), 'tg-vault-openlist-range-'));
    const input = path.join(dir, 'video.bin');
    const expected = Buffer.from('0123456789');
    await writeFile(input, expected);
    try {
        const provider = new OpenListStorageProvider('account-1', address, '/vault', 'alice', 'secret', undefined, undefined, undefined, fetch);
        const storedPath = await provider.saveFile(input, 'video.bin', 'video/mp4');
        const stream = await provider.getFileStream(storedPath, { range: 'bytes=2-5' }) as NodeJS.ReadableStream & { upstreamStatus?: number; upstreamHeaders?: Headers };
        assert.equal(stream.upstreamStatus, 206);
        assert.equal(stream.upstreamHeaders?.get('content-range'), 'bytes 2-5/10');
        assert.deepEqual(await collect(stream), Buffer.from('2345'));
        await provider.deleteFile(storedPath);
        assert.equal(fixture.objects.has(storedPath), false);
    } finally {
        await new Promise<void>(resolve => fixture.server.close(() => resolve()));
        await rm(dir, { recursive: true, force: true });
    }
});
