import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const queue = fs.readFileSync(new URL('../components/ui/UploadQueueModal.tsx', import.meta.url), 'utf8');

test('upload queue renders the persisted failure reason', () => {
    assert.match(queue, /item\.error &&/);
    assert.match(queue, /role="alert"/);
    assert.match(queue, /\{item\.error\}/);
});
