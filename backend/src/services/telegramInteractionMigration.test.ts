import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const state = fs.readFileSync(new URL('./telegramState.ts', import.meta.url), 'utf8');
const bot = fs.readFileSync(new URL('./telegramBot.ts', import.meta.url), 'utf8');
const paths = fs.readFileSync(new URL('../utils/telegramPathSettings.ts', import.meta.url), 'utf8');

test('PIN TOTP wizard and path prompts use TTL bounded interaction stores', () => {
    assert.match(state, /passwordInputState = new ScopedInteractionMap/);
    assert.match(state, /userStates = new ScopedInteractionMap/);
    assert.match(bot, /new TelegramInteractionStore<TelegramWizardState>/);
    assert.match(paths, /pendingPathInputState = new ScopedInteractionMap/);
    assert.match(state, /TELEGRAM_INTERACTION_TTL_MS/);
    assert.match(state, /TELEGRAM_INTERACTION_MAX_ENTRIES/);
});

test('restart semantics are fail closed because temporary stores are in memory only', () => {
    assert.doesNotMatch(state, /INSERT INTO telegram_interaction_states/);
    assert.doesNotMatch(paths, /pendingPathInputState[\s\S]*system_settings/);
});
