import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFileList } from './telegramMessages.js';

const veryLong = '超长_[名称]*'.repeat(80);
const files = Array.from({ length: 50 }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    name: `${veryLong}-${index}`,
    type: 'image',
    size: 1024,
    folder: `${veryLong}/目录/${index}`,
    created_at: '2026-08-28T00:00:00.000Z',
}));

test('recent file output stays within Telegram limits with hostile long names and folders', () => {
    const text = buildFileList(files, files.length);
    assert.ok(text.length < 3900, `length=${text.length}`);
    assert.doesNotMatch(text, /\*\*超长_\[名称\]\*/);
    assert.match(text, /…/);
});
