import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const tasks = fs.readFileSync(new URL('./TasksPage.tsx', import.meta.url), 'utf8');
const settings = fs.readFileSync(new URL('./SettingsPage.tsx', import.meta.url), 'utf8');
const layout = fs.readFileSync(new URL('../layout/AppLayout.tsx', import.meta.url), 'utf8');

test('task success feedback auto-dismisses while retaining a manual close control', () => {
    assert.match(tasks, /useEffect\(\(\) => \{\s*if \(!notice\) return;[\s\S]*setTimeout\(\(\) => setNotice\(null\), 4_000\)/);
    assert.match(tasks, /aria-live="polite"/);
    assert.match(tasks, /aria-label="关闭提示"/);
});

test('the global header owns the theme switch on every page', () => {
    assert.match(layout, /data-testid="header-theme-switch"/);
    assert.match(layout, /useTheme\(\)/);
    assert.match(layout, /value: "light" as const/);
    assert.match(layout, /value: "dark" as const/);
    assert.match(layout, /value: "system" as const/);
    assert.match(layout, /setTheme\(option\.value\)/);
    assert.doesNotMatch(settings, /label=\{t\("settings\.general\.theme"\)\}/);
});

test('settings uses non-modal transient feedback for notices but keeps confirmations and prompts modal', () => {
    assert.match(settings, /interface ActionNoticeState/);
    assert.match(settings, /role="status"/);
    assert.match(settings, /aria-live="polite"/);
    assert.match(settings, /window\.setTimeout\(\(\) => closeActionNotice\(\), 4_000\)/);
    assert.match(settings, /setActionNotice\(\{ title, message, tone:[^\n]*\}\);/);
    assert.match(settings, /return Promise\.resolve\(\);/);
    assert.doesNotMatch(settings, /window\.location\.reload\(\)/);
    assert.doesNotMatch(settings, /interface ActionNoticeState[\s\S]*resolve\?:/);
    assert.doesNotMatch(settings, /mode:\s*'notice'\s*\|\s*'confirm'\s*\|\s*'prompt'/);
    assert.doesNotMatch(settings, /state\.mode === 'notice' \? '知道了'/);
});
