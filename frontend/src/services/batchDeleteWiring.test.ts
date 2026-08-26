import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

test('bulk delete click does not pass the React event into the batch-delete payload', () => {
    assert.doesNotMatch(app, /onDelete=\{handleBatchDelete\}/);
    assert.match(app, /onDelete=\{\(\) => void handleBatchDelete\(\)\}/);
});
