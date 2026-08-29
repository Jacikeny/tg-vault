import assert from 'node:assert/strict';
import test from 'node:test';
import { parseXhrError } from './xhrError.js';
import { isUnauthorizedError } from './apiActionError.js';

test('auth statuses expire session', () => {
  assert.equal(isUnauthorizedError(parseXhrError(401, '')), true);
});
