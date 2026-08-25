import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { shouldUseSecureCookie } from './cookieSecurity.js';

const installScript = fs.readFileSync(new URL('../../../deploy/install.sh', import.meta.url), 'utf8');
const compose = fs.readFileSync(new URL('../../../docker-compose.yml', import.meta.url), 'utf8');

test('an explicit COOKIE_SECURE=false overrides the production default for documented local HTTP debugging', () => {
    assert.equal(shouldUseSecureCookie({ NODE_ENV: 'production', COOKIE_SECURE: 'false' }), false);
});

test('legacy COOKIE_SECURE_FORCE=false also overrides the production default', () => {
    assert.equal(shouldUseSecureCookie({ NODE_ENV: 'production', COOKIE_SECURE_FORCE: 'false' }), false);
});

test('a formal install force keeps secure cookies on even if a stale COOKIE_SECURE value says false', () => {
    assert.equal(shouldUseSecureCookie({ NODE_ENV: 'production', COOKIE_SECURE: 'false', COOKIE_SECURE_FORCE: 'true' }), true);
});

test('formal installs still force secure cookies even if a stale environment tries to weaken them', () => {
    assert.match(installScript, /COOKIE_SECURE=true/);
    assert.match(installScript, /COOKIE_SECURE_FORCE=true/);
    assert.match(compose, /COOKIE_SECURE_FORCE=\$\{COOKIE_SECURE_FORCE:-\}/);
});

test('secure cookies default on in production and off outside production', () => {
    assert.equal(shouldUseSecureCookie({ NODE_ENV: 'production' }), true);
    assert.equal(shouldUseSecureCookie({ NODE_ENV: 'development' }), false);
});

test('an explicit COOKIE_SECURE=true is always honored', () => {
    assert.equal(shouldUseSecureCookie({ NODE_ENV: 'development', COOKIE_SECURE: 'true' }), true);
});
