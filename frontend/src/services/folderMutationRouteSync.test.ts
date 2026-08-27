import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

test('folder rename and move replace the current route with the authoritative path', () => {
    const rename = app.slice(app.indexOf('const handleFolderRename'), app.indexOf('// 创建空文件夹'));
    const move = app.slice(app.indexOf('const handleMoveFolder'), app.indexOf('const previewFolderMove'));
    assert.match(rename, /syncCurrentFolderRoute\(/);
    assert.match(move, /syncCurrentFolderRoute\(/);
    assert.match(app, /window\.history\.replaceState\(\{\}, '', appRouteHref\(routeForCategory\(currentCategory, \{ folder, query: searchQuery \}\)\)\)/);
});
