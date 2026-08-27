import test from 'node:test';
import assert from 'node:assert/strict';
import { createUploadTargetSnapshot } from './uploadTargetSnapshot.js';

const cases = [
    ['local', '本地存储', null],
    ['onedrive', 'OneDrive', 'account-onedrive'],
    ['google_drive', 'Google Drive', 'account-google'],
    ['aliyun_oss', '阿里云 OSS', 'account-oss'],
    ['s3', 'S3', 'account-s3'],
    ['webdav', 'WebDAV', 'account-webdav'],
    ['openlist', 'OpenList', 'account-openlist'],
] as const;

for (const [provider, providerLabel, accountId] of cases) {
    test(`${provider} upload target keeps its canonical provider id for simple and chunked requests`, () => {
        const target = createUploadTargetSnapshot({
            provider,
            activeAccountId: accountId,
            activeAccountName: accountId ? `${provider} account` : null,
        }, providerLabel, 'incoming');

        assert.equal(target.provider, provider);
        assert.equal(target.accountId, accountId);
        assert.equal(target.folder, 'incoming');
        assert.equal(target.label, `${providerLabel} / ${accountId ? `${provider} account` : '服务器本地目录'} / incoming`);
    });
}

test('account name falls back to the selected account when the active name is absent', () => {
    const target = createUploadTargetSnapshot({
        provider: 'webdav',
        activeAccountId: 'account-webdav',
        activeAccountName: null,
        accounts: [{ id: 'account-webdav', type: 'webdav', name: 'NAS' } as any],
    }, 'WebDAV', null);

    assert.equal(target.provider, 'webdav');
    assert.equal(target.accountName, 'NAS');
    assert.equal(target.label, 'WebDAV / NAS / 根目录');
});

test('unknown provider ids fail before the request can be sent', () => {
    assert.throws(() => createUploadTargetSnapshot({
        provider: 'WebDAV',
        activeAccountId: 'account-webdav',
        activeAccountName: 'NAS',
    }, 'WebDAV'), /不支持的上传存储类型/);
});

test('upload target falls back to local storage before config is loaded', () => {
    assert.deepEqual(createUploadTargetSnapshot(null, null), {
        provider: 'local',
        accountId: null,
        accountName: null,
        folder: null,
        label: '本地存储 / 服务器本地目录 / 根目录',
    });
});
