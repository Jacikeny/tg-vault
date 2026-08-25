import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { WebDAVStorageProvider } from './storage.js';

function createWebDavFixture() {
    const objects = new Map<string, Buffer>();
    const normalizePath = (raw = '/') => decodeURIComponent(new URL(raw, 'http://localhost').pathname).replace(/^\/dav\/?/, '/') || '/';
    const propResponse = (requestPath: string, size = 0) => `<?xml version="1.0" encoding="utf-8"?><d:multistatus xmlns:d="DAV:"><d:response><d:href>/dav${requestPath === '/' ? '/' : requestPath}</d:href><d:propstat><d:prop><d:displayname>${path.posix.basename(requestPath) || 'dav'}</d:displayname><d:resourcetype>${requestPath === '/' ? '<d:collection/>' : ''}</d:resourcetype><d:getcontentlength>${size}</d:getcontentlength><d:getlastmodified>${new Date().toUTCString()}</d:getlastmodified></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>`;
    const server = http.createServer(async (req, res) => {
        const objectPath = normalizePath(req.url);
        if (req.method === 'PROPFIND') {
            if (objectPath !== '/' && !objects.has(objectPath)) { res.writeHead(404); return res.end(); }
            const body = propResponse(objectPath, objects.get(objectPath)?.length || 0);
            res.writeHead(207, { 'Content-Type': 'application/xml; charset=utf-8', 'Content-Length': Buffer.byteLength(body) }); return res.end(body);
        }
        if (req.method === 'PUT') { const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk)); objects.set(objectPath, Buffer.concat(chunks)); res.writeHead(201); return res.end(); }
        if (req.method === 'GET' || req.method === 'HEAD') { const body = objects.get(objectPath); if (!body) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Length': body.length }); return req.method === 'HEAD' ? res.end() : res.end(body); }
        if (req.method === 'DELETE') { objects.delete(objectPath); res.writeHead(204); return res.end(); }
        res.writeHead(405); res.end();
    });
    return { server, objects };
}

test('WebDAV runtime supports full file round-trip over loopback HTTP once the account is admitted', async () => {
    const { server, objects } = createWebDavFixture();
    const port = await new Promise<number>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => resolve((server.address() as any).port)); });
    const dir = await mkdtemp(path.join(os.tmpdir(), 'tg-vault-webdav-runtime-'));
    const input = path.join(dir, 'payload.txt');
    const expected = Buffer.from('tg-vault WebDAV runtime round-trip');
    await writeFile(input, expected);
    try {
        const provider = new WebDAVStorageProvider('loopback-http', `http://127.0.0.1:${port}/dav`);
        await provider.probe();
        const storedPath = await provider.saveFile(input, 'round-trip.txt', 'text/plain');
        assert.equal(await provider.getFileSize(storedPath), expected.length);
        const stream = await provider.getFileStream(storedPath);
        const chunks: Buffer[] = [];
        for await (const chunk of stream as any) chunks.push(Buffer.from(chunk));
        assert.deepEqual(Buffer.concat(chunks), expected);
        await provider.deleteFile(storedPath);
        assert.equal(objects.has('/round-trip.txt'), false);
    } finally {
        await new Promise<void>(resolve => server.close(() => resolve()));
        await rm(dir, { recursive: true, force: true });
    }
});
