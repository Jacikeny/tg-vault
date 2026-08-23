import assert from 'node:assert/strict';
import test from 'node:test';
import type { StorageTargetSnapshot } from './storage.js';
import { resolveChannelJobTargetSnapshot } from './telegramChannelJobAdmission.js';

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

test('an explicit confirmed target is preserved when the global target changes', () => {
    const confirmed = target('s3', 'account-a');
    const current = target('google_drive', 'account-b');
    let activeTargetReads = 0;

    const resolved = resolveChannelJobTargetSnapshot(confirmed, () => {
        activeTargetReads += 1;
        return current;
    });

    assert.equal(resolved, confirmed);
    assert.equal(resolved.provider.name, 's3');
    assert.equal(resolved.accountId, 'account-a');
    assert.equal(activeTargetReads, 0);
});

test('legacy admission without an explicit target snapshots the active target exactly once', () => {
    const current = target('webdav', 'account-c');
    let activeTargetReads = 0;

    const resolved = resolveChannelJobTargetSnapshot(undefined, () => {
        activeTargetReads += 1;
        return current;
    });

    assert.equal(resolved, current);
    assert.equal(activeTargetReads, 1);
});
