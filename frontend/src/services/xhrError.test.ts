import assert from 'node:assert/strict';
import test from 'node:test';
import { parseXhrError } from './xhrError.js';

test('auth statuses expire session', () => {
  assert.equal(parseXhrError(401, '').message, 'UNAUTHORIZED');
});
