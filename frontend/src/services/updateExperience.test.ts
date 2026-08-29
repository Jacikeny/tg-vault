import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const layout = fs.readFileSync(new URL('../components/layout/AppLayout.tsx', import.meta.url), 'utf8');
const settings = fs.readFileSync(new URL('../components/pages/SettingsPage.tsx', import.meta.url), 'utf8');
const apiTypes = fs.readFileSync(new URL('./apiTypes.ts', import.meta.url), 'utf8');
const systemClient = fs.readFileSync(new URL('./clients/systemClient.ts', import.meta.url), 'utf8');

test('authenticated app exposes a dismissible global release banner keyed by release version', () => {
    assert.match(layout, /getUpdateStatus\(\)/);
    assert.match(layout, /tgvault:update-dismissed:/);
    assert.match(layout, /window\.setInterval\(loadStatus, 15 \* 60 \* 1000\)/);
    assert.match(layout, /visibilitychange/);
    assert.match(layout, /updateAvailable/);
    assert.match(layout, /updates\.viewRelease/);
    assert.match(layout, /target="_blank"/);
    assert.match(layout, /updates\.dismiss/);
});

test('general settings shows current/latest versions and supports a manual check', () => {
    assert.match(settings, /updates\.settingsTitle/);
    assert.match(settings, /currentVersion/);
    assert.match(settings, /latestVersion/);
    assert.match(settings, /updates\.lastChecked/);
    assert.match(settings, /updates\.checkNow/);
    assert.match(settings, /checkForUpdates\(\)/);
});

test('frontend API calls authenticated no-store system update endpoints', () => {
    assert.match(systemClient, /\/api\/system\/update-status/);
    assert.match(systemClient, /\/api\/system\/update-check/);
    assert.match(apiTypes, /export interface UpdateStatus/);
});
