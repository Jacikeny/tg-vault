import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { buildStorageCapabilities } from '../utils/storageProductContract.js';

const storageRoute = fs.readFileSync(new URL('./storage.ts', import.meta.url), 'utf8');
const filesRoute = fs.readFileSync(new URL('./files.ts', import.meta.url), 'utf8');
const foldersRoute = fs.readFileSync(new URL('./folderOperations.ts', import.meta.url), 'utf8');
const manager = fs.readFileSync(new URL('../services/storage.ts', import.meta.url), 'utf8');
const telegramCommands = fs.readFileSync(new URL('../services/telegramCommands.ts', import.meta.url), 'utf8');
const crypto = fs.readFileSync(new URL('../utils/credentialCrypto.ts', import.meta.url), 'utf8');

test('OpenList account creation is authenticated, public-https guarded, and stores encrypted login credentials', () => {
    const section = storageRoute.slice(storageRoute.indexOf("router.post('/config/openlist'"), storageRoute.indexOf('// 切换存储提供商'));
    assert.match(section, /requireAuth/);
    assert.match(section, /assertPublicStorageEndpoint\(baseUrl\)/);
    assert.match(storageRoute, /addOpenListAccount/);
    assert.match(storageRoute, /STORAGE_PROBE_FAILED/);
    assert.match(manager, /encryptStorageConfig\(\{ baseUrl, rootPath, username, password \}\)/);
    assert.match(crypto, /'username'/);
});

test('OpenList is a first-class storage source and user deletion is denied at single and batch endpoints', () => {
    assert.match(manager, /this\.providers\.set\(`openlist:\$\{row\.id\}`/);
    assert.match(storageRoute, /provider === 'openlist'/);
    assert.equal(buildStorageCapabilities('openlist').userDelete, false);
    assert.match(filesRoute, /USER_DELETE_UNSUPPORTED/);
    assert.match(foldersRoute, /USER_DELETE_UNSUPPORTED/);
    assert.match(telegramCommands, /file\.source === 'openlist'/);
});
