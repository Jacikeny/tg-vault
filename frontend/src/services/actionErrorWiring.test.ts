import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const api = fs.readFileSync(new URL('./api.ts', import.meta.url), 'utf8');
const card = fs.readFileSync(new URL('../components/ui/FileCard.tsx', import.meta.url), 'utf8');
const preview = fs.readFileSync(new URL('../components/ui/PreviewModal.tsx', import.meta.url), 'utf8');

test('download, share and original-source API failures use the unified response classifier', () => {
    assert.match(api, /apiActionErrorFromResponse/);
    const actionArea = api.slice(api.indexOf('async createShareLink'), api.indexOf('async getAdvancedTaskSettings'));
    assert.ok((actionArea.match(/apiActionErrorFromResponse\(/g) || []).length >= 3);
});

test('file card and preview render actionable classified failure copy', () => {
    assert.match(card, /describeActionFailure\('下载'/);
    assert.match(preview, /describeActionFailure\('下载'/);
    assert.match(preview, /describeActionFailure\('复制文件 ID'/);
    assert.match(preview, /describeActionFailure\('打开原文件'/);
});

test('unauthorized action errors trigger the shared logout path', () => {
    assert.match(card, /error instanceof ApiActionError && error.kind === 'unauthorized'/);
    assert.match(preview, /error instanceof ApiActionError && error.kind === 'unauthorized'/);
    assert.match(card, /authService\.invalidateSession/);
    assert.match(preview, /authService\.invalidateSession/);
});
