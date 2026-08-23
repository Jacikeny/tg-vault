import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const bot = fs.readFileSync(new URL('./telegramBot.ts', import.meta.url), 'utf8');
const jobs = fs.readFileSync(new URL('./telegramChannelJobs.ts', import.meta.url), 'utf8');

test('date and tag wizards require a final scope and target confirmation', () => {
    assert.match(bot, /step === 'confirm'/);
    assert.match(bot, /请确认任务范围/);
    assert.match(bot, /固定存储/);
    assert.match(bot, /估计量将在扫描中实时更新/);
    assert.match(bot, /共 \$\{state\.dayCount/);
    assert.match(bot, /范围较大/);
    assert.match(bot, /parseTelegramDateRange\(state\.startDate!, input\)/);
    assert.match(bot, /发送 `确认` 开始/);
});

test('confirmed channel jobs pass an immutable target snapshot to admission', () => {
    assert.match(bot, /state\.target = target/);
    assert.match(bot, /target: state\.target/);
    assert.match(jobs, /resolveChannelJobTargetSnapshot\(options\.target/);
    assert.match(jobs, /target,/);
    assert.doesNotMatch(jobs, /storageProvider: options\.targetProvider/);
    assert.doesNotMatch(jobs, /storageAccountId: options\.targetAccountId/);
});
