import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const settings = fs.readFileSync(new URL('./SettingsPage.tsx', import.meta.url), 'utf8');

const storageGuideUrl = 'https://hicocos.github.io/tg-vault/storage.html';
const legacyReadmeAnchor = 'https://github.com/hicocos/tg-vault#%EF%B8%8F-%E7%8E%AF%E5%A2%83%E5%8F%98%E9%87%8F%E9%85%8D%E7%BD%AE';

test('storage setup guide opens the published TG Vault storage documentation', () => {
    assert.match(settings, new RegExp(`href=["']${storageGuideUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`));
    assert.doesNotMatch(settings, new RegExp(legacyReadmeAnchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(settings, /target="_blank"/);
    assert.match(settings, /rel="noopener noreferrer"/);
});
