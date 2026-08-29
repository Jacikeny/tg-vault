import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { buildSubscriptionDisplayLines, buildSubscriptionManagePanel } from '../bot/presentation/subscription.js';

const botSource = fs.readFileSync(new URL('./telegramBot.ts', import.meta.url), 'utf8');
const commandSource = fs.readFileSync(new URL('./telegramCommands.ts', import.meta.url), 'utf8');

test('button-driven panels do not print command syntax as primary instructions', () => {
    const targetPanel = commandSource.slice(
        commandSource.indexOf("export async function handleTarget"),
        commandSource.indexOf("export async function handleStorageSwitch"),
    );
    assert.doesNotMatch(targetPanel, /用法：/);
    assert.match(targetPanel, /buttons:/);

    const wizardPrompt = botSource.slice(
        botSource.indexOf('function buildTelegramWizardPrompt'),
        botSource.indexOf('function isDateOnly'),
    );
    assert.doesNotMatch(wizardPrompt, /date` \/ `tag|comments`|no-comments|yes` \/ `no/);

    const progress = botSource.slice(
        botSource.indexOf('export function buildLegacyJobProgressPresentation'),
        botSource.indexOf('async function updateJobProgressMessage'),
    );
    assert.doesNotMatch(progress, /\/task_pause|\/task_resume|\/task_cancel/);
});

test('subscription panel uses user language and stays compact', () => {
    const row = {
        id: 'sub-1',
        enabled: true,
        title: '壁纸频道',
        source: '@wallpaper',
        source_original: '@wallpaper',
        last_message_id: 42,
        target_mode: 'follow_global',
        last_scan_at: '2026-08-28T00:00:00.000Z',
        next_scan_at: '2026-08-28T01:00:00.000Z',
    };
    const detail = buildSubscriptionDisplayLines(row, 0);
    const panel = buildSubscriptionManagePanel([row], { page: 0, totalPages: 1, startIndex: 0, visibleRows: [row] });

    assert.doesNotMatch(detail, /last_id=|Target：|admission|unknown/);
    assert.match(detail, /同步位置：第 42 条消息之后/);
    assert.match(detail, /存储：跟随系统默认/);
    assert.doesNotMatch(panel, /回复频道用户名|https:\/\/t\.me\/\+hash|\/path_rules/);
    assert.match(panel, /点击下方按钮管理或新增订阅/);
});
