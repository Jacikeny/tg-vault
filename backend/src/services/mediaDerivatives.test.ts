import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const upload = fs.readFileSync(new URL('../routes/upload.ts', import.meta.url), 'utf8');
const chunked = fs.readFileSync(new URL('../routes/chunkedUpload.ts', import.meta.url), 'utf8');
const worker = fs.readFileSync(new URL('./mediaDerivatives.ts', import.meta.url), 'utf8');
const schema = fs.readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');

test('web and chunk completion enqueue media derivatives after save and index', () => {
    assert.doesNotMatch(upload, /await generateThumbnail|await generateMediaPreview|await getImageDimensions/);
    assert.doesNotMatch(chunked, /await generateThumbnail|await generateMediaPreview|await getImageDimensions/);
    assert.match(upload, /saveAndIndexWithCompensation[\s\S]*enqueueMediaDerivatives/);
    assert.match(chunked, /markChunkReconciliationIndexPresent[\s\S]*enqueueMediaDerivatives/);
});

test('bounded derivative worker persists processing lifecycle and has timeouts', () => {
    assert.match(worker, /MEDIA_DERIVATIVE_CONCURRENCY/);
    assert.match(worker, /MEDIA_DERIVATIVE_TIMEOUT_MS/);
    assert.match(worker, /derivative_status = 'processing'/);
    assert.match(worker, /derivative_status = 'ready'/);
    assert.match(worker, /derivative_status = 'failed'/);
    assert.match(schema, /derivative_status/);
});

test('derivative jobs are durable, recovered at startup, and do not release slots before timed-out work settles', () => {
    assert.match(worker, /recoverMediaDerivativeJobs/);
    assert.match(worker, /derivative_source_path/);
    assert.match(worker, /await promise\.catch/);
    assert.match(worker, /requiredResult/);
    assert.match(schema, /idx_files_derivative_pending/);
});
