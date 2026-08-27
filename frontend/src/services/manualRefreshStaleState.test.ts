import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const app = fs.readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

test('manual refresh determines stale fallback from live rows instead of a captured render', () => {
    const block = app.slice(app.indexOf('const loadFiles = useCallback'), app.indexOf('const loadMoreFiles'));
    assert.match(app, /const filesRef = useRef<FileData\[\]>\(files\)/);
    assert.match(app, /filesRef\.current = files/);
    assert.match(block, /filesRef\.current\.length/);
    assert.doesNotMatch(block, /const hadData = files\.length/);
});
