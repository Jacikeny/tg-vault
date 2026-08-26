import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const route = fs.readFileSync(new URL('./storage.ts', import.meta.url), 'utf8');
const queries = fs.readFileSync(new URL('../services/storageDeletePreview.ts', import.meta.url), 'utf8');
const preview = route.slice(
    route.indexOf("router.post('/accounts/:id/delete-confirmation'"),
    route.indexOf("router.delete('/accounts/:id'"),
);

test('storage deletion preview counts every reference enforced by execution', () => {
    assert.match(preview, /buildStorageDeletePreviewQueries\(req\.params\.id\)/);
    assert.match(queries, /FROM transfer_tasks/);
    assert.match(queries, /FROM telegram_background_jobs/);
    assert.match(queries, /FROM telegram_target_states/);
    assert.match(queries, /FROM telegram_channel_subscriptions/);
    assert.match(queries, /target_mode = 'fixed'/);
    assert.match(queries, /params->>'storageAccountId' = \$1::text/);
    assert.match(queries, /target_account_id = \$1::uuid/);
    assert.match(preview, /activeTaskCount/);
});
