import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const route = fs.readFileSync(new URL('../routes/storage.ts', import.meta.url), 'utf8');
const schema = fs.readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../index.ts', import.meta.url), 'utf8');
const frontendApi = fs.readFileSync(new URL('../../../frontend/src/services/api.ts', import.meta.url), 'utf8');
const settings = fs.readFileSync(new URL('../../../frontend/src/components/pages/SettingsPage.tsx', import.meta.url), 'utf8');

test('multi-account API exposes account lifecycle, access checks and QR login behind admin auth', () => {
    for (const marker of [
        "/config/telegram-user/accounts'",
        "/config/telegram-user/accounts/:accountId'",
        "/config/telegram-user/accounts/:accountId/check'",
        "/config/telegram-user/access/check-all'",
        '/config/telegram-user/accounts/login/qr',
    ]) assert.match(route, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(route, /requireAuth/);
    assert.match(route, /telegramUserLoginLimiter/);
    assert.match(route, /noStore\(res\)/);
});

test('account sessions and QR tokens never appear in public API payload contracts', () => {
    const publicSlice = route.slice(route.indexOf("/config/telegram-user/accounts"), route.indexOf("/config/telegram-allowed-users"));
    assert.doesNotMatch(publicSlice, /session_ciphertext\s*:/i);
    assert.doesNotMatch(frontendApi, /sessionCiphertext|StringSession|phoneCodeHash/);
    assert.match(schema, /session_ciphertext TEXT NOT NULL/);
});

test('application initializes the account pool independently of Telegram Bot enabled state', () => {
    assert.match(index, /initializeTelegramMultiAccountRuntime|initTelegramUserClientPool|initTelegramUserAccounts/);
    const botGuard = index.slice(index.indexOf('if (telegramEnabled)'), index.indexOf('await initializeYtDlpQueue'));
    assert.doesNotMatch(botGuard, /initTelegramUserClientPool|initTelegramUserAccounts/);
});

test('Web settings provide QR-first multi-account controls and permission summaries', () => {
    const ui = settings + fs.readFileSync(new URL('../../../frontend/src/components/pages/TelegramUserAccountsPanel.tsx', import.meta.url), 'utf8');
    for (const copy of ['添加账号', '二维码登录', '手机号登录', '权限检测']) assert.match(ui, new RegExp(copy));
    assert.match(ui, /智能调度|智能均衡|智能负载均衡/);
    assert.match(ui, /可访问/);
    assert.match(ui, /不可访问|无权限/);
    for (const method of ['getTelegramUserAccounts', 'startTelegramUserQrLogin', 'getTelegramUserLoginStatus', 'setTelegramUserAccountEnabled', 'checkTelegramUserAccountPermissions']) assert.match(frontendApi, new RegExp(method));
});
