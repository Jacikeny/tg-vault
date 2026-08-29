import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import en from '../locales/en.json' with { type: 'json' };
import zh from '../locales/zh.json' with { type: 'json' };

const loginPage = fs.readFileSync(new URL('../components/pages/LoginPage.tsx', import.meta.url), 'utf8');

function resolve(catalog: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, catalog);
}

test('the public login screen exposes a language switch before authentication', () => {
    assert.match(loginPage, /<LanguageToggle\s*\/>/);
});

test('the public login journey uses stable locale keys in both languages', () => {
    const keys = [
        'login.setupTitle', 'login.passwordTitle', 'login.totpTitle',
        'login.adminPasswordLabel', 'login.passwordLabel', 'login.signIn',
        'login.sessionFooter', 'login.telegramPinHint',
    ];
    for (const key of keys) {
        assert.equal(typeof resolve(en as Record<string, unknown>, key), 'string', `missing English login key: ${key}`);
        assert.equal(typeof resolve(zh as Record<string, unknown>, key), 'string', `missing Chinese login key: ${key}`);
        assert.match(loginPage, new RegExp(key.replaceAll('.', '\\.')));
    }
    assert.doesNotMatch(loginPage, /useRuntimeUiLocalization|MutationObserver/);
});

test('login credential fields declare password-manager autocomplete semantics', () => {
    assert.match(loginPage, /autoComplete=\{setupRequired \? ['"]new-password['"] : ['"]current-password['"]\}/);
    assert.match(loginPage, /id="confirm-password"[\s\S]*?autoComplete="new-password"/);
    assert.match(loginPage, /id="telegram-pin"[\s\S]*?autoComplete="new-password"/);
    assert.match(loginPage, /id="totp"[\s\S]*?autoComplete="one-time-code"/);
});
