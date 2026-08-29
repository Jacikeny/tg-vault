import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const auth = fs.readFileSync(new URL('./auth.ts', import.meta.url), 'utf8');

test('settings auth operations invalidate globally on expired sessions', () => {
    assert.match(auth, /invalidateForAuthStatus/);
    assert.match(auth, /response\.status !== 401 && response\.status !== 428/);
    assert.ok((auth.match(/this\.invalidateForAuthStatus\(response\)/g) || []).length >= 5);
});
