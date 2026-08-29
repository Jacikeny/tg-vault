import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const api = fs.readFileSync(new URL('./api.ts', import.meta.url), 'utf8');
const types = fs.readFileSync(new URL('./apiTypes.ts', import.meta.url), 'utf8');

test('Telegram multi-account API exposes list, QR polling, account lifecycle and permission checks', () => {
    for (const method of [
        'getTelegramUserAccounts',
        'startTelegramUserQrLogin',
        'getTelegramUserLoginStatus',
        'cancelTelegramUserLogin',
        'startTelegramUserPhoneLogin',
        'submitTelegramUserLoginCode',
        'submitTelegramUserLoginPassword',
        'setTelegramUserAccountEnabled',
        'unlinkTelegramUserAccountById',
        'checkTelegramUserAccountPermissions',
    ]) {
        assert.match(api, new RegExp(`async ${method}\\b`), `missing ${method}`);
    }

    assert.match(api, /\/api\/storage\/config\/telegram-user\/accounts/);
    assert.match(api, /encodeURIComponent\(accountId\)/);
    assert.match(api, /encodeURIComponent\(flowId\)/);
    assert.match(api, /telegram-accounts\/login\/phone/);
    assert.match(api, /telegram-accounts\/login\/code/);
});

test('public Telegram account types include health, permission summary and scheduling without secrets', () => {
    for (const typeName of [
        'TelegramUserAccount',
        'TelegramUserAccountHealth',
        'TelegramPermissionSummary',
        'TelegramUserAccountsOverview',
        'TelegramUserLoginState',
        'TelegramUserQrLoginStarted',
    ]) {
        assert.match(types, new RegExp(`export (?:interface|type) ${typeName}\\b`), `missing ${typeName}`);
    }

    const start = types.indexOf('export interface TelegramUserAccount {');
    const end = types.indexOf('export interface TelegramUserAccountsOverview', start);
    assert.ok(start >= 0 && end > start);
    const publicAccount = types.slice(start, end);
    assert.doesNotMatch(publicAccount, /\bphone\b|phoneNumber|phoneCodeHash|sessionString|StringSession|apiHash|token:/i);
});

test('QR payload remains an opaque typed field and is never logged by the client', () => {
    assert.match(types, /qrCode:\s*string/);
    const telegramClient = api.slice(api.indexOf('async getTelegramUserAccounts'), api.indexOf('async setTelegramUserDownloadEnabled'));
    assert.doesNotMatch(telegramClient, /console\.(?:log|info|debug|warn|error)/);
});
