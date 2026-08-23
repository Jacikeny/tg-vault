import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileTelegramAllowedUsers } from './telegramState.js';

function fakeQuery(authenticatedIds: number[]) {
    const calls: Array<{ sql: string; params?: unknown[] }> = [];
    const query = async (sql: string, params?: unknown[]) => {
        calls.push({ sql, params });
        if (/SELECT user_id FROM telegram_auth/.test(sql)) {
            return { rows: authenticatedIds.map(user_id => ({ user_id })), rowCount: authenticatedIds.length } as any;
        }
        if (/DELETE FROM telegram_auth/.test(sql)) {
            const keep = new Set((params?.[0] as number[]) || []);
            const revoked = authenticatedIds.filter(id => !keep.has(id));
            return { rows: revoked.map(user_id => ({ user_id })), rowCount: revoked.length } as any;
        }
        throw new Error(`unexpected SQL: ${sql}`);
    };
    return { query, calls };
}

test('allowlist reconciliation atomically revokes removed DB and cache auth users', async () => {
    const cache = new Map<number, { authenticatedAt: Date }>([
        [1, { authenticatedAt: new Date(0) }],
        [2, { authenticatedAt: new Date(0) }],
        [3, { authenticatedAt: new Date(0) }],
    ]);
    const db = fakeQuery([1, 2, 3]);
    const result = await reconcileTelegramAllowedUsers([2, 4], { query: db.query as any, cache });

    assert.deepEqual(result.added, [4]);
    assert.deepEqual(result.removed, [1, 3]);
    assert.deepEqual(result.revoked, [1, 3]);
    assert.deepEqual([...cache.keys()], [2]);
    assert.match(db.calls[1].sql, /DELETE FROM telegram_auth/);
});

test('broadcast recipients are always the current allowlist and authenticated-cache intersection', async () => {
    const cache = new Map<number, { authenticatedAt: Date }>([
        [2, { authenticatedAt: new Date(0) }],
        [3, { authenticatedAt: new Date(0) }],
    ]);
    const db = fakeQuery([2, 3]);
    const result = await reconcileTelegramAllowedUsers([2, 4], { query: db.query as any, cache });
    assert.deepEqual(result.recipients, [2]);
});
