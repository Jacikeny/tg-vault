import assert from 'node:assert/strict';
import test from 'node:test';
import { dismissibleTaskSnapshot } from './taskQuickFilters.js';

const tasks = [
    { sourceType: 'telegram_channel', id: 'account-a-failed', status: 'failed', dismissible: true, target: { accountId: 'account-a' } },
    { sourceType: 'telegram_channel', id: 'account-b-failed', status: 'failed', dismissible: true, target: { accountId: 'account-b' } },
    { sourceType: 'web_upload', id: 'account-a-completed', status: 'completed', dismissible: true, target: { accountId: 'account-a' } },
];

test('task dismissal snapshot preserves account and quick-filter scope as explicit identities', () => {
    const snapshot = dismissibleTaskSnapshot(tasks, {
        source: '',
        status: '',
        accountId: 'account-a',
        quickFilter: 'attention',
    });
    assert.deepEqual(snapshot.map(task => ({ sourceType: task.sourceType, id: task.id })), [
        { sourceType: 'telegram_channel', id: 'account-a-failed' },
    ]);
});
