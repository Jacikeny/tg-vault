import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('./ytDlpDownload.ts', import.meta.url), 'utf8');

const execution = source.slice(source.indexOf('async function executeYtDlpTask'), source.indexOf('class PersistentYtDlpQueue'));
const admission = source.slice(source.indexOf('export async function handleYtDlpCommand'), source.indexOf('\n}', source.indexOf('export async function handleYtDlpCommand')) + 2);

test('yt-dlp task admission rejects non-public URLs before persisting or enqueueing a task', () => {
    assert.match(admission, /await assertPublicHttpUrl\(url\)/);
    assert.ok(admission.indexOf('await assertPublicHttpUrl(url)') < admission.indexOf('createTransferTask('));
});

test('durable yt-dlp execution revalidates the URL immediately before spawning the downloader', () => {
    assert.match(execution, /await assertPublicHttpUrl\(sourceUrl\)[\s\S]*?await runYtDlpDownload\(sourceUrl/);
});
