import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const tailwind = fs.readFileSync(new URL('../../tailwind.config.js', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const fileTypeFilter = fs.readFileSync(new URL('../components/ui/FileTypeFilter.tsx', import.meta.url), 'utf8');

test('floating surfaces expose solid semantic colors to Tailwind', () => {
    assert.match(tailwind, /card:\s*\{/);
    assert.match(tailwind, /popover:\s*\{/);
    assert.match(tailwind, /destructive:\s*\{/);
    assert.match(fileTypeFilter, /bg-popover/);
});

test('native select menus use an opaque themed option surface', () => {
    assert.match(styles, /select\s+option/);
    assert.match(styles, /background-color:\s*hsl\(var\(--popover\)\)/);
    assert.match(styles, /color:\s*hsl\(var\(--popover-foreground\)\)/);
});
