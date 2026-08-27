import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

test('file type toolbar preserves the current folder and search scope', () => {
    const block = app.slice(app.indexOf('const handleFileTypeChange'), app.indexOf('const navigateFolder'));
    assert.match(block, /routeForCategory\(category, \{ folder: currentFolder, query: searchQuery \}\)/);
    assert.match(app, /onChange=\{handleFileTypeChange\}/);
});
