import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

test('visible files and folders both use the debounced query snapshot', () => {
    const filtered = app.slice(app.indexOf('const filteredFiles'), app.indexOf('// 将数据库中的完整 folder'));
    assert.match(filtered, /debouncedSearchQuery\.toLowerCase\(\)/);
    assert.doesNotMatch(filtered, /searchQuery\.toLowerCase\(\)/);
});
