import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const dialog = fs.readFileSync(new URL('../components/ui/Dialog.tsx', import.meta.url), 'utf8');
const confirm = fs.readFileSync(new URL('../components/ui/ConfirmDialog.tsx', import.meta.url), 'utf8');
const create = fs.readFileSync(new URL('../components/ui/CreateFolderModal.tsx', import.meta.url), 'utf8');
const i18n = fs.readFileSync(new URL('../i18n.ts', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../index.css', import.meta.url), 'utf8');

test('shared Dialog traps Tab, closes on Escape when allowed, and restores trigger focus', () => {
    assert.match(dialog, /querySelectorAll/);
    assert.match(dialog, /event\.key !== 'Tab'/);
    assert.match(dialog, /event\.key === 'Escape'/);
    assert.match(dialog, /previousFocus\?\.focus/);
    assert.match(dialog, /aria-modal="true"/);
});

test('product dialogs consume the shared Dialog primitive', () => {
    assert.match(confirm, /from '\.\/Dialog'/);
    assert.match(create, /from "\.\/Dialog"/);
});

test('language, reduced motion, and 360px overflow protections are active', () => {
    assert.match(i18n, /document\.documentElement\.lang/);
    assert.match(css, /prefers-reduced-motion: reduce/);
    assert.match(css, /overflow-x: hidden/);
});
