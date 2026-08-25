import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

test('hidden file controls do not reserve mobile vertical space', () => {
    assert.match(app, /\{isSelectionMode && \(\s*<div className="sticky top-0 z-30 -mx-4 px-4 pt-2">/);
    assert.doesNotMatch(app, /<div className="flex-1 flex flex-col mt-8">/);
    assert.match(app, /gap-4 max-w-7xl mx-auto min-h-full sm:gap-8/);
});
