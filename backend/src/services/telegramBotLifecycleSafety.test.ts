import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const config = fs.readFileSync(new URL('./telegramBotConfig.ts', import.meta.url), 'utf8');
const bot = fs.readFileSync(new URL('./telegramBot.ts', import.meta.url), 'utf8');
const jobs = fs.readFileSync(new URL('./telegramChannelJobs.ts', import.meta.url), 'utf8');
const routes = fs.readFileSync(new URL('../routes/storage.ts', import.meta.url), 'utf8');
const settings = fs.readFileSync(new URL('../utils/settings.ts', import.meta.url), 'utf8');

test('Web Telegram credentials stay outside process.env and decrypt fail closed', () => {
    assert.doesNotMatch(config, /process\.env\.TELEGRAM_(?:BOT_TOKEN|API_ID|API_HASH)\s*=/);
    assert.match(config, /getSettingStrict/);
    assert.match(settings, /export async function getSettingStrict/);
    assert.match(config, /凭证不完整，已拒绝回退到环境变量/);
});

test('all Bot lifecycle mutations share one serialized operation', () => {
    assert.match(bot, /withTelegramBotLifecycle/);
    for (const route of ['put', 'post', 'delete']) assert.match(routes, new RegExp(`router\\.${route}\\(`));
    assert.ok((routes.match(/withTelegramBotLifecycle/g) || []).length >= 4);
    assert.doesNotMatch(routes, /\b(?:restartTelegramBot|stopTelegramBot)\(/);
});

test('activation failure restores persisted and runtime configuration', () => {
    assert.match(config, /snapshotTelegramBotConfig/);
    assert.match(config, /restoreTelegramBotConfig/);
    assert.match(routes, /catch \(activationError\)[\s\S]*restoreTelegramBotConfig\(previous\)[\s\S]*controls\.restart/);
});

test('client teardown waits for in-flight subscription and recovery work', () => {
    assert.match(jobs, /while \(subscriptionScanRunning \|\| recoveryRunning\)/);
    assert.match(jobs, /拒绝切换 Bot 客户端/);
    assert.match(bot, /await stopTelegramBackgroundWorkers\(\)/);
});
