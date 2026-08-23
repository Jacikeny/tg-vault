import assert from 'node:assert/strict';
import test from 'node:test';
import type { StorageTargetSnapshot } from './storage.js';
import { persistChannelJobAdmission } from './telegramChannelJobs.js';

function target(providerName: string, accountId: string | null): StorageTargetSnapshot {
    return {
        provider: {
            name: providerName,
            probe: async () => undefined,
            saveFile: async () => '',
            getFileStream: async () => { throw new Error('not used'); },
            getPreviewUrl: async () => '',
            deleteFile: async () => undefined,
        },
        accountId,
        providerKey: `${providerName}:${accountId || 'local'}`,
    };
}

test('channel job persistence keeps confirmed target in params and locks that account', async () => {
    const confirmed = target('s3', 'account-a');
    const current = target('google_drive', 'account-b');
    const lockedAccounts: string[] = [];
    const calls: Array<{ sql: string; params?: unknown[] }> = [];
    let activeTargetReads = 0;

    const id = await persistChannelJobAdmission({
        userId: 42,
        chatId: '-100123',
        kind: 'date_range',
        source: '@channel',
        params: { mode: 'date' },
        target: confirmed,
    }, {
        getActiveTarget: () => {
            activeTargetReads += 1;
            return current;
        },
        lockStorageAccount: async (_client, accountId) => {
            lockedAccounts.push(accountId);
        },
        withTransaction: async operation => operation({
            query: (async (sql: string, params?: unknown[]) => {
                calls.push({ sql, params });
                return { rows: [{ id: 'job-1' }], rowCount: 1 } as any;
            }) as any,
        }),
    });

    assert.equal(id, 'job-1');
    assert.equal(activeTargetReads, 0);
    assert.deepEqual(lockedAccounts, ['account-a']);
    assert.equal(calls.length, 1);
    const persisted = JSON.parse(String(calls[0].params?.[4]));
    assert.equal(persisted.storageProvider, 's3');
    assert.equal(persisted.storageAccountId, 'account-a');
    assert.equal(persisted.mode, 'date');
});
