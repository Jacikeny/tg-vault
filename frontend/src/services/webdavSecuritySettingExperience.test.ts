import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const settings = fs.readFileSync(new URL('../components/pages/SettingsPage.tsx', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('./api.ts', import.meta.url), 'utf8');

test('security settings expose an off-by-default unsafe WebDAV control with explicit risk confirmation', () => {
    assert.match(api, /allowUnsafeWebdavEndpoints/);
    assert.match(api, /setUnsafeWebdavEndpointsAllowed/);
    assert.match(settings, /网络与存储安全/);
    assert.match(settings, /允许内网和不安全的 WebDAV 地址/);
    assert.match(settings, /role="switch"/);
    assert.match(settings, /aria-checked=\{!!config\?\.allowUnsafeWebdavEndpoints\}/);
    assert.match(settings, /CONFIRMATION_REQUIRED/);
    assert.match(settings, /SSRF/);
    assert.match(settings, /明文/);
    assert.match(settings, /二次确认/);
});

test('risk confirmation is portalled to the viewport and has dedicated danger treatment', () => {
    assert.match(settings, /createPortal/);
    assert.match(settings, /tone\?: 'default' \| 'danger'/);
    assert.match(settings, /确认开启/);
    assert.match(settings, /bg-destructive\/10/);
});
