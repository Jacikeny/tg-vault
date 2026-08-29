import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const route = fs.readFileSync(new URL('./chunkedUpload.ts', import.meta.url), 'utf8');
const worker = fs.readFileSync(new URL('../services/mediaDerivatives.ts', import.meta.url), 'utf8');

test('chunked cloud media enqueues local thumbnail and preview work after index completion', () => {
    assert.match(route, /markChunkReconciliationIndexPresent[\s\S]*enqueueMediaDerivatives/);
    assert.match(worker, /generateThumbnail\(job\.sourcePath/);
    assert.match(worker, /generateMediaPreview\(job\.sourcePath/);
});

test('chunked cloud media source is retained until the derivative worker settles', () => {
    assert.match(route, /cleanupSource: target\.provider\.name !== 'local'/);
    assert.match(worker, /finally \{[\s\S]*if \(job\.cleanupSource\) await fs\.rm\(job\.sourcePath/);
});
