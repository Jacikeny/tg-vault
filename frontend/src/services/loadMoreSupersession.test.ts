import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

test('superseded pagination always releases the load-more UI flag', () => {
    const loader = app.slice(app.indexOf('const loadMoreFiles'), app.indexOf('// 加载存储统计'));
    assert.match(loader, /finally\s*\{\s*setLoadingMoreFiles\(false\)/);
    assert.doesNotMatch(loader, /finally\s*\{\s*if \(request\.isCurrent\(\)\) setLoadingMoreFiles\(false\)/);
});
