import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

test('moving a file reloads the authoritative file and folder aggregation snapshot', () => {
    const block = app.slice(app.indexOf('const handleMoveFile'), app.indexOf('const handleMoveFolder'));
    assert.match(block, /await refreshFilesAfterMutation\(\)/);
    assert.doesNotMatch(block, /setFiles\(prev => prev\.map/);
});
