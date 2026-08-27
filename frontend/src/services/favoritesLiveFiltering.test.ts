import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

test('favorites view filters by the live favorite flag', () => {
    const filtered = app.slice(app.indexOf('const filteredFiles'), app.indexOf('// 将数据库中的完整 folder'));
    assert.match(filtered, /currentCategory === "favorites" && file\.is_favorite === true/);
    assert.doesNotMatch(filtered, /^\s*currentCategory === "favorites" \|\|/m);
});
