import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTelegramFileActionRows, buildTelegramFileBrowserText, buildTelegramFileDetail, encodeTelegramFileCallback, parseTelegramFileCallback, queryTelegramFiles } from './telegramFileBrowser.js';

function rows(count: number, start = 0) {
    return Array.from({ length: count }, (_, i) => ({
        id: `00000000-0000-4000-8000-${String(start + i).padStart(12, '0')}`,
        name: `file-${start + i}.jpg`,
        type: 'image', size: 100 + i, folder: 'album', is_favorite: i % 2 === 0,
        created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, start + i)).toISOString(),
    })).reverse();
}

test('Telegram file browser uses keyset pages without duplicates beyond 201 files', async () => {
    const all = rows(205);
    const first = await queryTelegramFiles({ q: 'file', limit: '200' }, {
        scope: { kind: 'local' },
        runQuery: (async () => ({ rows: all.slice(0, 201) })) as any,
    });
    assert.equal(first.files.length, 200);
    assert.equal(first.hasMore, true);
    assert.ok(first.nextCursor);

    const second = await queryTelegramFiles({ q: 'file', limit: '200', cursor: first.nextCursor! }, {
        scope: { kind: 'local' },
        runQuery: (async () => ({ rows: all.slice(200) })) as any,
    });
    assert.equal(new Set([...first.files, ...second.files].map(file => file.id)).size, 205);
});

test('file operation callbacks carry the full object id under Telegram limits', () => {
    const file = rows(1)[0];
    const callback = encodeTelegramFileCallback('delete', file.id);
    assert.ok(Buffer.byteLength(callback, 'utf8') <= 64);
    assert.deepEqual(parseTelegramFileCallback(callback), { action: 'delete', fileId: file.id });
    assert.deepEqual(buildTelegramFileActionRows(file).flat().map(action => action.text), ['详情', '复制 ID', '取消收藏', '签名链接', '移动', '重命名', '删除…']);
    const detail = buildTelegramFileDetail({ ...file, source: 'local' });
    assert.match(detail, new RegExp(file.id));
    assert.match(detail, /local/);
});

test('file browser card includes detail and actionable-operation guidance', async () => {
    const page = await queryTelegramFiles({ limit: '8' }, {
        scope: { kind: 'local' },
        runQuery: (async () => ({ rows: rows(1) })) as any,
    });
    const text = buildTelegramFileBrowserText(page, 'photo');
    assert.match(text, /file-0\.jpg/);
    assert.match(text, /00000000-000/);
    assert.match(text, /收藏/);
    assert.match(text, /移动\/重命名/);
    assert.match(text, /删除确认/);
});

test('file browser text truncates long dynamic fields and formats sizes for mobile', () => {
    const hostile = '[name]_*'.repeat(100);
    const text = buildTelegramFileBrowserText({
        files: rows(8).map(file => ({ ...file, name: hostile, folder: hostile, size: 5 * 1024 * 1024 })),
        nextCursor: null,
        hasMore: false,
    }, hostile);
    assert.ok(text.length < 3900, `length=${text.length}`);
    assert.match(text, /5 MB/);
    assert.match(text, /…/);
    assert.doesNotMatch(text, /\*\*\*/);
});
