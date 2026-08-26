import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const settings = fs.readFileSync(new URL('../components/pages/SettingsPage.tsx', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('./api.ts', import.meta.url), 'utf8');

test('Settings provides a Chinese phone -> code -> optional 2FA account login wizard', () => {
    for (const copy of ['登录 Telegram 用户账号', '手机号', '验证码', '两步验证密码', '验证码已发送', '账号已绑定并自动启用']) {
        assert.match(settings, new RegExp(copy));
    }
    assert.match(settings, /telegramUserLoginStep/);
    assert.match(settings, /autoComplete="one-time-code"/);
    assert.match(settings, /autoComplete="current-password"/);
    assert.match(settings, /type="password"/);
});

test('bound accounts hide the login form, keep mobile actions readable, and disabled state is not presented as an error', () => {
    assert.match(settings, /!config\?\.telegramUserClientStatus\?\.userId &&/);
    assert.match(settings, /flex-col\s+gap-2\s+sm:flex-row/);
    assert.match(settings, /w-full\s+sm:w-auto/);
    assert.match(settings, /telegramUserClientStatus\?\.status !== 'disabled' && <Button/);
    assert.match(settings, /已停用，不会执行账号级下载/);
});
test('frontend exposes status, disable-retaining-session and destructive unlink without secret response fields', () => {
    for (const method of ['getTelegramUserAccount', 'startTelegramUserLogin', 'submitTelegramUserCode', 'submitTelegramUserPassword', 'disableTelegramUserAccount', 'unlinkTelegramUserAccount']) {
        assert.match(api, new RegExp(method));
    }
    assert.match(settings, /停用（保留登录）/);
    assert.match(settings, /解除绑定/);
    assert.match(settings, /保留已加密保存的登录信息/);
    assert.doesNotMatch(api.slice(api.indexOf('async getTelegramUserAccount'), api.indexOf('async setTelegramUserDownloadEnabled')), /phoneCodeHash|StringSession|apiHash/);
});
