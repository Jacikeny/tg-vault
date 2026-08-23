import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const schema = fs.readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
const commands = fs.readFileSync(new URL('./telegramCommands.ts', import.meta.url), 'utf8');

test('notification preference and digest storage are durable', () => {
    assert.match(schema, /CREATE TABLE IF NOT EXISTS telegram_notification_preferences/);
    assert.match(schema, /CREATE TABLE IF NOT EXISTS telegram_notification_digest/);
});

test('Bot exposes notification settings while security delivery remains mandatory', () => {
    assert.match(commands, /handleNotifications/);
    assert.match(commands, /安全告警仍始终即时/);
});
