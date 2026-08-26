import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const settings = fs.readFileSync(new URL('../components/pages/SettingsPage.tsx', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('./api.ts', import.meta.url), 'utf8');

test('Telegram bot credentials are write-only in the web settings experience', () => {
    assert.match(settings, /配置后只显示状态，不会回显 Bot Token、API ID 或 API Hash/);
    assert.match(settings, /type="password" autoComplete="new-password"/);
    assert.match(settings, /保存并启用/);
    assert.match(settings, /迁移到网页管理/);
    assert.match(settings, /更换凭证/);
    assert.match(settings, /取消更换/);
    assert.match(settings, /handleCancelTelegramBotEdit/);
    assert.match(settings, /Telegram Bot PIN：已设置，本次更换不会修改/);
    assert.match(settings, /修改 Bot PIN/);
    assert.match(settings, /Telegram Bot PIN：未设置/);
    assert.match(settings, /设置 Bot PIN/);
    assert.match(settings, /未设置 PIN 时，需要使用网页管理员密码验证身份/);
    assert.match(settings, /verificationMethod/);
    assert.match(api, /changeTelegramBotPin/);
    assert.match(settings, /删除后 Bot 将立即停止，已保存的 Bot Token、API ID、API Hash 和 Bot session 将被永久删除/);
    assert.match(settings, /cancelLabel: '取消删除', confirmLabel: '确认永久删除'/);
    assert.match(settings, /删除配置/);
    assert.doesNotMatch(settings, />停用<|handleDisableTelegramBot/);
    assert.match(settings, /grid-cols-3/);
    assert.ok((settings.match(/whitespace-nowrap/g) || []).length >= 3);
    assert.match(settings, /text-\[11px\]/);
    assert.doesNotMatch(settings, /Bot 离线时将应用标记为未就绪/);
    assert.match(settings, /enabled: true, required: false/);
    assert.match(api, /getTelegramBotConfig/);
    assert.match(api, /testTelegramBotConfig/);
    assert.match(api, /saveTelegramBotConfig/);
    assert.doesNotMatch(api, /botToken\?:|apiHash\?:|apiId\?:/);
});
