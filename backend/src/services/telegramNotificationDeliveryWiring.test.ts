import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
const bot = fs.readFileSync(new URL('./telegramBot.ts', import.meta.url), 'utf8');

test('production yt-dlp notifications pass through preference delivery and digest flush', () => {
    const notifier = bot.slice(bot.indexOf('setYtDlpNotifier'), bot.indexOf('// Ensure database table exists'));
    assert.match(notifier, /enqueueTelegramNotification/);
    assert.match(notifier, /flushTelegramNotificationDigest/);
    assert.match(notifier, /getConfiguredTelegramAllowedUsers/);
});
