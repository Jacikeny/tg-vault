import assert from 'node:assert/strict';
import test from 'node:test';
import type { StorageConfig } from './api.js';
import { synchronizeStorageConfig, uploadTargetAfterStorageSync } from './storageConfigSynchronization.js';

const config = (activeAccountId: string): StorageConfig => ({
    provider: 'onedrive',
    activeAccountId,
    activeAccountName: activeAccountId === 'account-b' ? 'Account B' : 'Account A',
    capabilities: { share: true, sharePassword: true, shareExpiration: true, quota: true, userDelete: true },
    accounts: [],
    redirectUri: '',
    googleDriveRedirectUri: '',
    allowUnsafeWebdavEndpoints: false,
});

test('OAuth storage synchronization publishes the authoritative config before the next upload snapshot', async () => {
    const published: StorageConfig[] = [];
    const synchronized = await synchronizeStorageConfig({
        loadConfig: async () => config('account-b'),
        publishConfig: value => { published.push(value); },
    }, 'account-b');

    assert.deepEqual(published, [synchronized]);
    assert.deepEqual(uploadTargetAfterStorageSync(synchronized, 'incoming'), {
        provider: 'onedrive',
        accountId: 'account-b',
        accountName: 'Account B',
        folder: 'incoming',
        label: 'onedrive / Account B / incoming',
    });
});

test('OAuth storage synchronization rejects a success message until the expected account is active', async () => {
    let publishCount = 0;
    await assert.rejects(
        synchronizeStorageConfig({
            loadConfig: async () => config('account-a'),
            publishConfig: () => { publishCount += 1; },
        }, 'account-b'),
        /尚未切换到新存储账户/,
    );
    assert.equal(publishCount, 0);
});
