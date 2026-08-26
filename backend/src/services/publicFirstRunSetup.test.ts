import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const backend = fs.readFileSync(new URL('../routes/auth.ts', import.meta.url), 'utf8');
const frontend = fs.readFileSync(new URL('../../../frontend/src/components/pages/LoginPage.tsx', import.meta.url), 'utf8');
const authClient = fs.readFileSync(new URL('../../../frontend/src/services/auth.ts', import.meta.url), 'utf8');

test('first public visitor can initialize without a setup token and only needs a Bot PIN when Bot credentials exist', () => {
    const setupRoute = backend.slice(backend.indexOf("router.post('/setup'"), backend.indexOf("router.post('/login'"));
    assert.doesNotMatch(setupRoute, /verifyInitialSetupAccess|INITIAL_SETUP_TOKEN|setupToken/);
    assert.match(setupRoute, /getEffectiveTelegramBotConfig/);
    assert.match(setupRoute, /telegramPinRequired/);
    assert.match(setupRoute, /createInitialAdminCredentials\(webPassword, telegramPinRequired \? telegramPin : undefined\)/);
});

test('first-run form conditionally asks for an exactly four-digit Telegram PIN', () => {
    assert.doesNotMatch(frontend, /setupToken|首次初始化令牌|INITIAL_SETUP_TOKEN/);
    assert.doesNotMatch(authClient, /setupToken|INITIAL_SETUP_TOKEN/);
    assert.match(frontend, /telegramPinRequired &&/);
    assert.match(frontend, /\^\\d\{4\}\$/);
    assert.match(frontend, /maxLength=\{4\}/);
    assert.match(authClient, /telegramPin\?: string/);
    assert.match(backend, /telegramPinRequired,/);
});
