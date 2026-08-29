import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const route = fs.readFileSync(new URL('./upload.ts', import.meta.url), 'utf8');
const worker = fs.readFileSync(new URL('../services/mediaDerivatives.ts', import.meta.url), 'utf8');

test('cloud image uploads enqueue local thumbnails and previews from the temporary source', () => {
    assert.match(route, /saveAndIndexWithCompensation[\s\S]*enqueueMediaDerivatives/);
    assert.match(worker, /generateThumbnail\(job\.sourcePath/);
    assert.match(worker, /generateMediaPreview\(job\.sourcePath/);
});

test('cloud video temporary source survives until asynchronous preview generation settles', () => {
    assert.match(route, /cleanupSource: provider\.name !== 'local'/);
    assert.match(worker, /finally \{[\s\S]*if \(job\.cleanupSource\) await fs\.rm\(job\.sourcePath/);
});
