import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { validateConfiguredStorageTarget } from './storageTargetReadiness.js';

test('configured cloud storage fails closed without exactly one matching active account', () => {
    assert.throws(() => validateConfiguredStorageTarget('google_drive', []), /google_drive/);
    assert.throws(
        () => validateConfiguredStorageTarget('google_drive', [{ id: 's3-id', type: 's3' }]),
        /google_drive/,
    );
    assert.deepEqual(
        validateConfiguredStorageTarget('google_drive', [{ id: 'drive-id', type: 'google_drive' }]),
        { id: 'drive-id', type: 'google_drive' },
    );
});

test('local storage fails closed when a cloud account is still marked active', () => {
    assert.equal(validateConfiguredStorageTarget('local', []), null);
    assert.throws(() => validateConfiguredStorageTarget('local', [{ id: 'drive-id', type: 'google_drive' }]), /local/);
});

test('application initializes dependencies once and readiness serves the refreshed memory snapshot', () => {
    const db = fs.readFileSync(new URL('../db/index.ts', import.meta.url), 'utf8');
    const app = fs.readFileSync(new URL('../index.ts', import.meta.url), 'utf8');
    assert.match(db, /export function ensureDatabaseInitialized/);
    assert.doesNotMatch(db, /pool\.on\('connect', async/);
    assert.match(app, /await ensureDatabaseInitialized\(\)[\s\S]*await storageManager\.init\(\)/);
    const readyRoute = app.slice(app.indexOf("app.get('/readyz'"), app.indexOf("app.get('/deepz'"));
    assert.match(readyRoute, /dependencyReadiness/);
    assert.doesNotMatch(readyRoute, /pool\.query|assertReady|get2FAReadiness/);
    assert.match(app, /app\.get\('\/deepz'[\s\S]*refreshDependencyReadiness/);
});
