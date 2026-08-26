import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const settings = fs.readFileSync(new URL('../components/pages/SettingsPage.tsx', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('./api.ts', import.meta.url), 'utf8');

test('Web exposes an immediate download history policy with errors-only as the recommended default', () => {
    assert.match(api, /telegramDownloadHistoryPolicy/);
    assert.match(settings, /下载明细记录/);
    assert.match(settings, /仅保留错误（推荐）/);
    assert.match(settings, /保留全部（完整审计）/);
    assert.match(settings, /value="errors_only"/);
    assert.match(settings, /value="all"/);
    assert.match(settings, /磁盘空间较小/);
    assert.match(settings, /磁盘充足且需要逐条核对下载历史/);
    assert.match(settings, /成功和跳过明细/);
    assert.match(settings, /stackActionOnMobile/);
    assert.match(settings, /w-full sm:w-auto/);
});

test('history cleanup remains available and clearly says it only deletes audit details', () => {
    assert.match(settings, /清理历史明细/);
    assert.match(settings, /不删除文件索引，也不删除云端文件/);
});
