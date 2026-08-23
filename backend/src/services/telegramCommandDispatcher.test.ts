import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCommandHomePage, dispatchTelegramCommand, type TelegramCommandContext } from './telegramCommandDispatcher.js';
import { BOT_COMMANDS } from '../utils/telegramCommandRegistry.js';

test('dispatcher resolves legacy aliases and runs authentication before the handler', async () => {
    const events: string[] = [];
    const context: TelegramCommandContext = { userId: 7, chatKey: '100', text: '/task' };
    const result = await dispatchTelegramCommand(context, {
        authenticate: async () => { events.push('auth'); return true; },
        rateLimit: () => { events.push('rate'); return { limited: false, retryAfterSeconds: 0 }; },
        handlers: { tasks: async () => { events.push('handler'); } },
    });
    assert.equal(result.command?.command, 'tasks');
    assert.equal(result.handled, true);
    assert.deepEqual(events, ['auth', 'rate', 'handler']);
});

test('dispatcher rejects unauthenticated and rate-limited commands consistently', async () => {
    const context: TelegramCommandContext = { userId: 7, chatKey: '100', text: '/tasks' };
    const denied = await dispatchTelegramCommand(context, {
        authenticate: async () => false,
        handlers: { tasks: async () => assert.fail('must not run') },
    });
    assert.equal(denied.reason, 'auth-required');

    const limited = await dispatchTelegramCommand(context, {
        authenticate: async () => true,
        rateLimit: () => ({ limited: true, retryAfterSeconds: 9 }),
        handlers: { tasks: async () => assert.fail('must not run') },
    });
    assert.equal(limited.reason, 'rate-limited');
    assert.equal(limited.retryAfterSeconds, 9);
});

test('categorized home pages make every help command reachable and callback data stays within Telegram limits', () => {
    const visible = BOT_COMMANDS.filter(command => command.help);
    const pages = Array.from({ length: 20 }, (_, page) => buildCommandHomePage(page)).filter(page => page.commands.length > 0);
    const reached = pages.flatMap(page => page.commands.map(command => command.command));
    assert.deepEqual(new Set(reached), new Set(visible.map(command => command.command)));
    for (const page of pages) {
        for (const button of page.buttons.flat()) assert.ok(Buffer.byteLength(button.data) < 64, button.data);
    }
});
