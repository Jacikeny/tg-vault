import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const route = fs.readFileSync(new URL('./tasks.ts', import.meta.url), 'utf8');
const service = fs.readFileSync(new URL('../services/ytDlpDownload.ts', import.meta.url), 'utf8');

test('authenticated Web users can create bounded yt-dlp tasks', () => {
    assert.match(route, /router\.post\('\/ytdlp', requireAuth/);
    assert.match(route, /createYtDlpTask/);
    assert.match(route, /format === 'audio' \? 'audio' : 'best'/);
    assert.match(route, /res\.status\(202\)\.json/);
});

test('shared yt-dlp admission validates public URLs and snapshots the target', () => {
    const start = service.indexOf('export async function createYtDlpTask');
    const end = service.indexOf('export async function handleYtDlpCommand', start);
    const admission = service.slice(start, end);
    assert.ok(start >= 0);
    assert.match(admission, /await assertPublicHttpUrl\(input\.url\)/);
    assert.match(admission, /input\.target \|\| storageManager\.getActiveTarget\(\)/);
    assert.match(admission, /targetFolder: input\.folder \|\| 'ytdlp'/);
    assert.match(admission, /ytDlpQueue\.enqueue\(task\.id\)/);
});
