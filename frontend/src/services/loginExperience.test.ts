import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const loginPage = fs.readFileSync(new URL('../components/pages/LoginPage.tsx', import.meta.url), 'utf8');
const runtimeEnglish = JSON.parse(fs.readFileSync(new URL('../locales/runtime-en.json', import.meta.url), 'utf8')) as Record<string, string>;

const loginCopy = [
    '首次启动，请创建唯一管理员密码',
    '请输入访问密码',
    '双重身份验证',
    '网页管理员密码',
    '访问密码',
    '登录',
    '登录状态将保留 7 天',
];

test('the public login screen exposes a language switch before authentication', () => {
    assert.match(loginPage, /<LanguageToggle\s*\/>/);
});

test('the English runtime catalog covers the public login journey', () => {
    for (const text of loginCopy) {
        assert.equal(typeof runtimeEnglish[text], 'string', `missing English login copy: ${text}`);
    }
    const chineseLiterals = [...loginPage.matchAll(/["'`]([^"'`\r\n]*[\u3400-\u9fff][^"'`\r\n]*)["'`]/g)]
        .map(match => match[1])
        .filter(text => !text.includes('请求失败，状态码'));
    for (const text of chineseLiterals) {
        assert.equal(typeof runtimeEnglish[text], 'string', `missing English login literal: ${text}`);
    }
});

test('login credential fields declare password-manager autocomplete semantics', () => {
    assert.match(loginPage, /autoComplete=\{setupRequired \? ['"]new-password['"] : ['"]current-password['"]\}/);
    assert.match(loginPage, /id="confirm-password"[\s\S]*?autoComplete="new-password"/);
    assert.match(loginPage, /id="telegram-pin"[\s\S]*?autoComplete="new-password"/);
    assert.match(loginPage, /id="totp"[\s\S]*?autoComplete="one-time-code"/);
});
