import assert from 'node:assert/strict';
import fs from 'node:fs';
import { canTelegramUserAuthenticate } from './telegramBot.js';

assert.equal(canTelegramUserAuthenticate(7, []), false);
assert.equal(canTelegramUserAuthenticate(7, [7]), true);
assert.equal(canTelegramUserAuthenticate(8, [7]), false);

const source = fs.readFileSync(new URL('./telegramBot.ts', import.meta.url), 'utf8');
const storageRoute = fs.readFileSync(new URL('../routes/storage.ts', import.meta.url), 'utf8');
const commandRegistry = fs.readFileSync(new URL('../utils/telegramCommandRegistry.ts', import.meta.url), 'utf8');
assert.doesNotMatch(source, /Received text from.*\$\{text\}/);
assert.doesNotMatch(source, /command received.*\$\{text\}/);
assert.match(source, /reconcileTelegramAllowedUsers\(allowedUsers\)/);
assert.doesNotMatch(source, /for \(const userId of authenticatedUsers\.keys\(\)\)/);
assert.match(source, /text === '\/logout'/);
assert.match(source, /await revokeAuthenticatedUser\(senderId\)/);
assert.match(commandRegistry, /command: 'logout'/);
assert.match(storageRoute, /added: reconciliation\.added\.length/);
assert.match(storageRoute, /removed: reconciliation\.removed\.length/);
assert.match(storageRoute, /revoked: reconciliation\.revoked\.length/);

console.log('telegram authentication allowlist ok');
