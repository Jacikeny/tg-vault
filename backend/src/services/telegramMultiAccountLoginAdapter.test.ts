import assert from 'node:assert/strict';
import test from 'node:test';
import { createTelegramMultiAccountAuthorizedAdapter } from './telegramMultiAccountLoginAdapter.js';

test('authorized adapter upserts by Telegram user id then refreshes the runtime pool', async () => {
    const calls: string[] = [];
    const adapter = createTelegramMultiAccountAuthorizedAdapter({
        repository: {
            async upsertAccount(input) {
                calls.push(`upsert:${input.telegramUserId}:${input.enabled}:${input.session}`);
                return { id: 'account-42' };
            },
        },
        pool: { async refresh() { calls.push('refresh'); } },
    });
    await adapter.upsertByTelegramUserId({
        session: 'secret-session',
        account: { userId: '42', username: 'owner', displayName: 'Vault Owner' },
    });
    assert.deepEqual(calls, ['upsert:42:true:secret-session', 'refresh']);
});