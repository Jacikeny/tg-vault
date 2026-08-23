import assert from 'node:assert/strict';
import test from 'node:test';
import { claimTelegramNotificationDigest } from './telegramNotificationDelivery.js';

test('digest claim leases events without marking them delivered before send succeeds', async () => {
    const calls: string[] = [];
    const rows = [{ id: 'a', kind: 'success', payload: { message: 'A' } }];
    const result = await claimTelegramNotificationDigest(1, '1', async (sql: string) => {
        calls.push(sql);
        return { rows: /RETURNING d\./.test(sql) ? rows : [] } as any;
    });
    assert.deepEqual(result, rows);
    assert.match(calls[0], /FOR UPDATE SKIP LOCKED/);
    assert.match(calls[0], /claimed_at = NOW/);
    assert.doesNotMatch(calls[0], /delivered_at = NOW/);
});
