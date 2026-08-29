import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const page = fs.readFileSync(new URL('../components/pages/TasksPage.tsx', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const apiTypes = fs.readFileSync(new URL('./apiTypes.ts', import.meta.url), 'utf8');

test('storage account references are deep-linked into a filtered task center', () => {
    assert.match(app, /kind: 'tasks', accountId/);
    assert.match(app, /initialAccountId=\{taskAccountId\}/);
    assert.match(page, /task\.target\.accountId === initialAccountId/);
    assert.match(page, /tasks\.subtitleScoped/);
});

test('task center exposes release actions for persistent Telegram references', () => {
    assert.match(apiTypes, /'telegram_target'/);
    assert.match(page, /tasks\.sources\.telegramTarget/);
    assert.match(page, /tasks\.actions\.followDefault/);
    assert.match(page, /tasks\.actions\.clearTarget/);
});
