import assert from 'node:assert/strict';
import test from 'node:test';
import { buildStorageDeletePreviewQueries } from './storageDeletePreview.js';

test('storage deletion preview compares text and UUID account references safely', () => {
    const queries = buildStorageDeletePreviewQueries('account-id');
    assert.equal(queries.tasks.values[0], 'account-id');
    assert.match(queries.tasks.text, /params->>'storageAccountId' = \$1::text/);
    assert.match(queries.tasks.text, /target_account_id = \$1::uuid/);
    assert.match(queries.tasks.text, /account_id = \$1::uuid/);
});
