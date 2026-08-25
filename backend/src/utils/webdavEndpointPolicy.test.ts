import assert from 'node:assert/strict';
import test from 'node:test';
import { assertStorageEndpoint } from './networkSecurity.js';

test('storage endpoints reject private WebDAV addresses by default', async () => {
    await assert.rejects(
        () => assertStorageEndpoint('https://192.168.1.20:5006/dav'),
        /不允许访问内网、回环或保留地址/,
    );
});

test('explicit unsafe WebDAV policy admits private HTTPS and HTTP endpoints', async () => {
    const privateHttps = await assertStorageEndpoint('https://192.168.1.20:5006/dav', {
        allowPrivateAddresses: true,
        allowInsecureHttp: true,
    });
    const privateHttp = await assertStorageEndpoint('http://192.168.1.20:5005/dav', {
        allowPrivateAddresses: true,
        allowInsecureHttp: true,
    });

    assert.equal(privateHttps.hostname, '192.168.1.20');
    assert.equal(privateHttp.protocol, 'http:');
});

test('unsafe WebDAV policy never admits non-http protocols', async () => {
    await assert.rejects(
        () => assertStorageEndpoint('file:///etc/passwd', {
            allowPrivateAddresses: true,
            allowInsecureHttp: true,
        }),
        /仅允许 http\/https 链接/,
    );
});
