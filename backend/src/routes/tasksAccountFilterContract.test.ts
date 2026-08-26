import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const tasks = fs.readFileSync(new URL('./tasks.ts', import.meta.url), 'utf8');
const transfers = fs.readFileSync(new URL('../services/transferTasks.ts', import.meta.url), 'utf8');

test('task center account filter reaches every task source before limiting', () => {
    assert.match(tasks, /req\.query\.accountId/);
    assert.match(tasks, /targetAccountId: accountId/);
    assert.match(tasks, /params->>'storageAccountId'\) = \$2::text/);
    assert.match(tasks, /target_account_id = \$2::uuid/);
    assert.match(tasks, /account_id = \$2::uuid/);
    assert.match(transfers, /targetAccountId\?: string/);
    assert.match(transfers, /target_account_id = \$\$\{params\.length\}::uuid/);
});
