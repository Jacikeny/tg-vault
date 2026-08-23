import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const bot = fs.readFileSync(new URL('./telegramBot.ts', import.meta.url), 'utf8');

test('Bot home uses categorized pages without fixed command truncation', () => {
    assert.match(bot, /buildCommandHomePage\(requestedPage\)/);
    assert.match(bot, /home_page_\(\\d\+\)/);
    assert.doesNotMatch(bot, /visible\.slice\(0, 12\)/);
});

test('home buttons route directly to operational panels for core commands', () => {
    assert.match(bot, /command === 'tasks'\) return handleTasks/);
    assert.match(bot, /command === 'storage_switch'\) return handleStorageSwitch/);
    assert.match(bot, /command === 'path_rules'\) return handlePathRules/);
    assert.match(bot, /command === 'tg_download'\) return startTelegramWizard/);
    assert.match(bot, /command === 'tg_sub'\) return startTelegramWizard/);
    assert.doesNotMatch(bot, /请发送 \/\$\{data\.replace/);
});
