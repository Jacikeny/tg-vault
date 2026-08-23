import assert from 'node:assert/strict';
import test from 'node:test';
import type { StorageTargetSnapshot } from '../services/storage.js';
import {
    consumeTelegramTargetState,
    getTelegramTargetState,
    setTelegramTargetState,
    type TelegramTargetStateQuery,
} from './telegramTargetStateStore.js';

function memoryQuery(): TelegramTargetStateQuery {
    const rows = new Map<string, any>();
    return async (sql, params) => {
        const [chatId, mode] = params;
        const key = `${chatId}:${mode || ''}`;
        if (/INSERT INTO telegram_target_states/.test(sql)) {
            rows.set(key, { chat_id: chatId, mode, provider: params[2], account_id: params[3], expires_at: params[4] });
            return { rows: [], rowCount: 1 };
        }
        if (/DELETE FROM telegram_target_states[\s\S]*RETURNING/.test(sql)) {
            const row = rows.get(`${chatId}:once`);
            rows.delete(`${chatId}:once`);
            return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
        }
        if (/SELECT .*telegram_target_states/.test(sql)) {
            const row = rows.get(`${chatId}:${mode}`);
            return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
        }
        throw new Error(`unexpected SQL ${sql}`);
    };
}

test('next target is consumed atomically once while session target remains', async () => {
    const query = memoryQuery();
    await setTelegramTargetState(query, 'chat-a', 'once', 's3', 'account-a', new Date(Date.now() + 100_000));
    const first = await consumeTelegramTargetState(query, 'chat-a');
    const second = await consumeTelegramTargetState(query, 'chat-a');
    assert.deepEqual(first, { provider: 's3', accountId: 'account-a', mode: 'once' });
    assert.equal(second, null);

    await setTelegramTargetState(query, 'chat-b', 'session', 'webdav', 'account-b', new Date(Date.now() + 100_000));
    assert.deepEqual(await getTelegramTargetState(query, 'chat-b', 'session'), { provider: 'webdav', accountId: 'account-b', mode: 'session' });
    assert.deepEqual(await getTelegramTargetState(query, 'chat-b', 'session'), { provider: 'webdav', accountId: 'account-b', mode: 'session' });
});

test('two chats resolve independent target snapshots and global fallback is captured once', async () => {
    const query = memoryQuery();
    await setTelegramTargetState(query, 'chat-a', 'session', 's3', 'account-a', new Date(Date.now() + 100_000));
    await setTelegramTargetState(query, 'chat-b', 'session', 'google_drive', 'account-b', new Date(Date.now() + 100_000));
    assert.notDeepEqual(await getTelegramTargetState(query, 'chat-a', 'session'), await getTelegramTargetState(query, 'chat-b', 'session'));
});
