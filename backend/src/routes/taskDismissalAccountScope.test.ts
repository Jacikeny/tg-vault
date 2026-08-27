import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const tasks = fs.readFileSync(new URL('./tasks.ts', import.meta.url), 'utf8');

test('task dismissal preview applies the requested storage account scope', () => {
    const block = tasks.slice(tasks.indexOf("router.post('/dismissals/prepare'"), tasks.indexOf("router.post('/dismissals/confirm'"));
    assert.match(block, /req\.body\?\.accountId/);
    assert.match(block, /collectUnifiedTasks\(500, accountId \|\| undefined\)/);
});
