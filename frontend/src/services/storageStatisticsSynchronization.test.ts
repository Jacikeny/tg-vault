import assert from 'node:assert/strict';
import test from 'node:test';
import type { StorageStats } from './api.js';
import { StorageStatisticsSynchronization } from './storageStatisticsSynchronization.js';

function stats(accountId: string): StorageStats {
    return {
        provider: 'onedrive', accountId,
        capabilities: { share: true, sharePassword: true, shareExpiration: true, quota: true, userDelete: true },
        temporary: { totalBytes: 1, usedBytes: 0, freeBytes: 1, usedPercent: 0 },
        indexed: { usedBytes: 0, fileCount: 0 }, remoteQuota: null,
        health: { probeStatus: 'available', lastProbedAt: null, cooldownUntil: null, cooldownReason: null },
        server: { total: '1 B', totalBytes: 1, used: '0 B', usedBytes: 0, free: '1 B', freeBytes: 1, usedPercent: 0 },
        tgvault: { used: '0 B', usedBytes: 0, fileCount: 0 },
    };
}

test('a slow account A statistics response cannot overwrite a newer account B request', () => {
    const synchronization = new StorageStatisticsSynchronization();
    const accountA = synchronization.begin('account-a');
    const accountB = synchronization.begin('account-b');

    assert.equal(accountA.accept(stats('account-a')), false);
    assert.equal(accountB.accept(stats('account-b')), true);
    assert.equal(accountB.accept(stats('account-a')), false);
});
