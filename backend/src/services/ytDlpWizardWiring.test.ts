import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const bot = fs.readFileSync(new URL('./telegramBot.ts', import.meta.url), 'utf8');
const download = fs.readFileSync(new URL('./ytDlpDownload.ts', import.meta.url), 'utf8');

test('pasted and explicit URLs only create a probe preview before confirmation', () => {
    assert.match(bot, /createYtDlpPreview\(message, senderId, pastedUrl\)/);
    assert.match(bot, /createYtDlpPreview\(message, senderId, url\)/);
    assert.match(bot, /没有确认不会创建下载任务/);
    assert.match(bot, /handleYtDlpPreviewCallback/);
    assert.match(bot, /ytDlpConfirmations\.consume/);
});

test('confirmed yt-dlp keeps immutable target format folder and metadata in task admission', () => {
    assert.match(bot, /handleYtDlpCommand\(currentMessage, consumed\.value\.url, consumed\.value\.target/);
    assert.match(download, /targetFolder: options\.folder \|\| 'ytdlp'/);
    assert.match(download, /format: options\.format \|\| 'best'/);
    assert.match(download, /\['--no-playlist', '--newline'/);
    assert.match(download, /'-o', outputTemplate, '--', url/);
    assert.doesNotMatch(bot, /cookie.*text/i);
});
