import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
const layout = fs.readFileSync(new URL('../layout/AppLayout.tsx', import.meta.url), 'utf8');
const filter = fs.readFileSync(new URL('./FileTypeFilter.tsx', import.meta.url), 'utf8');

test('media categories live in the my-files toolbar instead of the sidebar', () => {
    assert.doesNotMatch(layout, /id: "media"/);
    assert.doesNotMatch(layout, /id: "image"/);
    assert.doesNotMatch(layout, /id: "video"/);
    assert.doesNotMatch(layout, /id: "audio"/);
    assert.doesNotMatch(layout, /id: "document"/);
    assert.match(app, /<FileTypeFilter/);
    assert.match(app, /value=\{currentCategory\}/);
    assert.match(app, /handleCategoryChange\(category\)/);
});

test('file type filter exposes all requested categories and accessible selection state', () => {
    for (const id of ['all', 'image', 'video', 'audio', 'document']) {
        assert.match(filter, new RegExp(`id: "${id}" as const`));
    }
    assert.match(filter, /aria-haspopup="menu"/);
    assert.match(filter, /aria-expanded=\{isOpen\}/);
    assert.match(filter, /role="menuitemradio"/);
    assert.match(filter, /aria-checked=\{selected\}/);
    assert.match(filter, /grid w-full grid-cols-5/);
    assert.match(filter, /aria-pressed=\{selected\}/);
    assert.match(filter, /icon: Filter/);
    assert.doesNotMatch(filter, /icon: Files/);
});
