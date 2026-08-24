import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('./storage.ts', import.meta.url), 'utf8');
const preview = source.slice(
    source.indexOf("router.post('/accounts/:id/delete-confirmation'"),
    source.indexOf("router.delete('/accounts/:id'"),
);

test('storage deletion preview counts every reference enforced by execution', () => {
    assert.match(preview, /FROM transfer_tasks/);
    assert.match(preview, /FROM telegram_background_jobs/);
    assert.match(preview, /FROM telegram_target_states/);
    assert.match(preview, /FROM telegram_channel_subscriptions/);
    assert.match(preview, /target_mode = 'fixed'/);
    assert.match(preview, /params->>'storageAccountId'/);
    assert.match(preview, /activeTaskCount/);
});
