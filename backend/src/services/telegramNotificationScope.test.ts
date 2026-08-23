import assert from 'node:assert/strict';
import test from 'node:test';
import { listTelegramNotificationDigestScopes } from './telegramNotificationDelivery.js';

test('digest scope listing returns every pending user/chat pair including group chats', async () => {
    const calls: string[] = [];
    const scopes = await listTelegramNotificationDigestScopes(async (sql: string) => {
        calls.push(sql);
        return { rows: [
            { user_id: '42', chat_id: '42' },
            { user_id: '42', chat_id: '-100123' },
        ] } as any;
    });
    assert.deepEqual(scopes, [
        { userId: 42, chatId: '42' },
        { userId: 42, chatId: '-100123' },
    ]);
    assert.match(calls[0], /delivered_at IS NULL/);
    assert.match(calls[0], /GROUP BY user_id, chat_id/);
});
