import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveNotificationOwnerUserId } from './telegramNotificationDelivery.js';

test('notification owner uses explicit task owner rather than chat id', () => {
    assert.equal(resolveNotificationOwnerUserId(42, '-100123'), 42);
    assert.equal(resolveNotificationOwnerUserId(null, '123'), 123);
    assert.throws(() => resolveNotificationOwnerUserId(null, '-100123'), /owner user/i);
});
