import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const composer = fs.readFileSync(new URL('../components/pages/YtDlpTaskComposer.tsx', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('./api.ts', import.meta.url), 'utf8');

test('YT-DLP page exposes a focused add-task form', () => {
    assert.match(app, /currentCategory === "ytdlp"[\s\S]*<YtDlpTaskComposer/);
    assert.match(composer, /type="url"/);
    assert.match(composer, /视频（最佳质量）/);
    assert.match(composer, /仅音频（MP3）/);
    assert.match(composer, /添加下载任务/);
});

test('YT-DLP task submission uses the authenticated task API and surfaces progress guidance', () => {
    assert.match(api, /createYtDlpTask/);
    assert.match(api, /\/api\/tasks\/ytdlp/);
    assert.match(api, /method: 'POST'/);
    assert.match(api, /credentials: 'include'/);
    assert.match(app, /fileApi\.createYtDlpTask/);
    assert.match(composer, /任务中心/);
});
