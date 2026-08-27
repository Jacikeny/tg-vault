import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

const looseBlock = app.slice(app.indexOf('const looseFiles'), app.indexOf('const mediaPreviewFiles'));
const renameBlock = app.slice(app.indexOf('const handleFileRename'), app.indexOf('const handleFolderRename'));

test('file rows preserve the authoritative server order in root and nested folders', () => {
    assert.doesNotMatch(looseBlock, /\.sort\(/);
});

test('renaming reloads authoritative ordering instead of guessing the database collation', () => {
    assert.match(renameBlock, /await refreshFilesAfterMutation\(\)/);
});
