import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const zone = fs.readFileSync(new URL('../components/ui/UploadZone.tsx', import.meta.url), 'utf8');

test('upload zone is keyboard reachable and opens the file picker with Enter or Space', () => {
    assert.match(zone, /role="button"/);
    assert.match(zone, /tabIndex=\{disabled \? -1 : 0\}/);
    assert.match(zone, /onKeyDown=\{handleKeyDown\}/);
    assert.match(zone, /e\.key === 'Enter' \|\| e\.key === ' '/);
});
