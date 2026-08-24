import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const page = fs.readFileSync(new URL('../components/pages/TasksPage.tsx', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('./api.ts', import.meta.url), 'utf8');

test('storage account references are deep-linked into a filtered task center', () => {
    assert.match(app, /kind: 'tasks', accountId/);
    assert.match(app, /initialAccountId=\{taskAccountId\}/);
    assert.match(page, /task\.target\.accountId === initialAccountId/);
    assert.match(page, /仅显示仍引用所选存储账户/);
});

test('task center exposes release actions for persistent Telegram references', () => {
    assert.match(api, /'telegram_target'/);
    assert.match(page, /Telegram 会话目标/);
    assert.match(page, /改为跟随默认/);
    assert.match(page, /清除目标/);
});
