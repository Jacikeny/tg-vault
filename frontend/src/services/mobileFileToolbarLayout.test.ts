import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

test('mobile file toolbar gives category tabs their own full-width row and keeps complete control groups visible', () => {
  assert.match(source, /data-testid="file-toolbar"[^>]*className="[^"]*w-full[^"]*flex-col[^"]*"/);
  assert.match(source, /<FileTypeFilter[\s\S]*value=\{currentCategory\}/);
  assert.match(source, /data-testid="file-toolbar-primary"[^>]*className="[^"]*min-w-0[^"]*"/);
  assert.match(source, /data-testid="file-toolbar-secondary"[^>]*className="[^"]*shrink-0[^"]*"/);
});
