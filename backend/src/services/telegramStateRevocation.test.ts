import assert from 'node:assert/strict';
import test from 'node:test';
import { revokeAuthenticatedUser } from './telegramState.js';

test('revoking authentication only clears cache after durable deletion succeeds', async () => {
    const cache = new Map([[42, { authenticatedAt: new Date() }]]);
    await assert.rejects(
        revokeAuthenticatedUser(42, {
            cache,
            query: async () => { throw new Error('database unavailable'); },
        }),
        /database unavailable/,
    );
    assert.equal(cache.has(42), true);

    await revokeAuthenticatedUser(42, {
        cache,
        query: async () => ({ rows: [], rowCount: 1 }),
    });
    assert.equal(cache.has(42), false);
});
