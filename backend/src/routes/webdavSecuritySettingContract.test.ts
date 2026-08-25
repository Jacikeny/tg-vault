import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const route = fs.readFileSync(new URL('./storage.ts', import.meta.url), 'utf8');

test('unsafe WebDAV access defaults off and enabling it requires server confirmation', () => {
    assert.match(route, /allow_unsafe_webdav_endpoints/);
    assert.match(route, /getSetting\('allow_unsafe_webdav_endpoints', 'false'\)/);
    assert.match(route, /code: 'CONFIRMATION_REQUIRED'/);
    assert.match(route, /confirmed !== true/);
});

test('WebDAV endpoint admission uses the persisted security setting', () => {
    const webdavRoute = route.slice(
        route.indexOf("router.post('/config/webdav'"),
        route.indexOf("router.post('/switch'"),
    );
    assert.match(webdavRoute, /allowUnsafeWebdavEndpoints/);
    assert.match(webdavRoute, /assertStorageEndpoint/);
    assert.match(webdavRoute, /allowPrivateAddresses/);
    assert.match(webdavRoute, /allowInsecureHttp/);
});
