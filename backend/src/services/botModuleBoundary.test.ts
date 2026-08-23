import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const bot = fs.readFileSync(new URL('./telegramBot.ts', import.meta.url), 'utf8');
const jobs = fs.readFileSync(new URL('./telegramChannelJobs.ts', import.meta.url), 'utf8');
const context = fs.readFileSync(new URL('../bot/context.ts', import.meta.url), 'utf8');
const presentation = fs.readFileSync(new URL('../bot/presentation/subscription.ts', import.meta.url), 'utf8');

test('Bot context and subscription presentation are extracted behind stable boundaries', () => {
    assert.match(context, /messageChatKey/);
    assert.match(context, /callbackChatKey/);
    assert.match(presentation, /buildSubscriptionDisplayLines/);
    assert.match(presentation, /buildSubscriptionManagePanel/);
});

test('large modules consume extracted boundaries while retaining domain protocols', () => {
    assert.match(bot, /from '\.\.\/bot\/context\.js'/);
    assert.match(bot, /from '\.\.\/bot\/presentation\/subscription\.js'/);
    assert.match(jobs, /finalizeSubscriptionJobInTransaction/);
    assert.match(jobs, /claimTelegramWriteReconciliations/);
});
