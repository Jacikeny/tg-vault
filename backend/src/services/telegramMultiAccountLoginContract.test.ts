import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const route = fs.readFileSync(new URL('../routes/storage.ts', import.meta.url), 'utf8');
const flows = fs.readFileSync(new URL('./telegramMultiAccountLoginFlows.ts', import.meta.url), 'utf8');
const gramJs = fs.readFileSync(new URL('./telegramMultiAccountLogin.ts', import.meta.url), 'utf8');

test('multi-account login routes are admin-only, rate-limited, no-store, session-bound, and cancellable', () => {
    assert.match(route, /telegramUserLoginLimiter\s*=\s*rateLimit/);
    const contracts: Array<[string, string, string]> = [
        ['post', '/config/telegram-accounts/login/phone', 'telegramUserLoginLimiter'],
        ['post', '/config/telegram-accounts/login/code', 'telegramUserLoginLimiter'],
        ['post', '/config/telegram-accounts/login/password', 'telegramUserLoginLimiter'],
        ['post', '/config/telegram-accounts/login/qr', 'telegramUserLoginLimiter'],
        ['get', '/config/telegram-accounts/login/qr/:flowId', 'telegramUserLoginStatusLimiter'],
        ['post', '/config/telegram-accounts/login/qr/:flowId/refresh', 'telegramUserLoginLimiter'],
        ['delete', '/config/telegram-accounts/login/:flowId', 'telegramUserLoginLimiter'],
    ];
    for (const [method, path, limiter] of contracts) {
        const escaped = path.replace(/[/:]/g, match => match === ':' ? '\\:' : `\\${match}`);
        assert.match(route, new RegExp(`router\\.${method}\\('${escaped}',\\s*requireAuth,\\s*${limiter}`));
    }
    const section = route.slice(route.indexOf("router.post('/config/telegram-accounts/login/phone'"), route.indexOf('// Legacy single-account login API'));
    assert.match(section, /getTelegramUserLoginSessionKey\(req\)/);
    assert.match(section, /noStore\(res\)/);
    assert.doesNotMatch(section, /ACCOUNT_ALREADY_BOUND|getTelegramUserAccountStatus/);
});

test('QR contract is ephemeral and never exposes raw token, code hash, or StringSession', () => {
    assert.match(flows, /tg:\/\/login\?token=\$\{result\.token\.toString\('base64url'\)\}/);
    assert.match(flows, /flowId: string;\s*status: TelegramQrLoginStatus;\s*qrData: string \| null;\s*expiresAt: string;\s*version: number;/s);
    assert.match(flows, /owner: string/);
    assert.match(flows, /scheduleCleanup/);
    assert.match(flows, /setQrLoginTokenHandler\(null\)/);
    assert.doesNotMatch(route, /phoneCodeHash|saveSession\(\)|token\.toString\('base64url'\)/);
});

test('login completion integrates through a userId-upsert adapter rather than a missing pool export', () => {
    assert.match(gramJs, /upsertByTelegramUserId/);
    assert.match(gramJs, /registerTelegramMultiAccountAuthorizedAdapter/);
    assert.match(gramJs, /await adapter\.upsertByTelegramUserId\(input\)/);
    assert.match(gramJs, /Api\.auth\.ExportLoginToken/);
    assert.match(gramJs, /Api\.UpdateLoginToken/);
    assert.match(gramJs, /SESSION_PASSWORD_NEEDED[\s\S]*password_required/);
});

test('legacy single-account phone/code/password routes remain available', () => {
    for (const suffix of ['phone', 'code', 'password']) {
        assert.match(route, new RegExp(`router\\.post\\('\\/config\\/telegram-user\\/login\\/${suffix}'`));
    }
});
