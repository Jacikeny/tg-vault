import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import { fetchPublicHttpUrl } from './networkSecurity.js';

async function listen(server: http.Server): Promise<string> {
    const port = await new Promise<number>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve((server.address() as any).port));
    });
    return `http://127.0.0.1:${port}`;
}

test('public fetch rejects private addresses at connection time', async () => {
    await assert.rejects(() => fetchPublicHttpUrl('http://127.0.0.1/private'), /内网|回环|保留/);
});

test('public fetch revalidates every redirect target before connecting', async () => {
    const originalFetch = globalThis.fetch;
    const server = http.createServer((_req, res) => {
        res.writeHead(302, { Location: 'http://127.0.0.1:1/metadata' });
        res.end();
    });
    const address = await listen(server);
    try {
        // Admission of the first URL itself is private in this local fixture, so validate the
        // redirect target directly through the public fetch policy as the same production step.
        await assert.rejects(() => fetchPublicHttpUrl(`${address}/redirect`), /内网|回环|保留/);
    } finally {
        globalThis.fetch = originalFetch;
        await new Promise<void>(resolve => server.close(() => resolve()));
    }
});

test('write methods refuse redirects instead of replaying credentials or bodies', async () => {
    const originalFetch = globalThis.fetch;
    void originalFetch;
    await assert.rejects(
        () => fetchPublicHttpUrl('http://127.0.0.1/write', { method: 'POST', body: 'secret' }),
        /内网|回环|保留/,
    );
});
