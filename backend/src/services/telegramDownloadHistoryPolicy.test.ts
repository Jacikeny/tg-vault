import assert from 'node:assert/strict';
import test from 'node:test';
import {
    DEFAULT_TELEGRAM_DOWNLOAD_HISTORY_POLICY,
    normalizeTelegramDownloadHistoryPolicy,
    terminalStatusesToDelete,
} from './telegramDownloadHistoryPolicy.js';

test('download history defaults to retaining errors only', () => {
    assert.equal(DEFAULT_TELEGRAM_DOWNLOAD_HISTORY_POLICY, 'errors_only');
    assert.equal(normalizeTelegramDownloadHistoryPolicy(undefined), 'errors_only');
    assert.equal(normalizeTelegramDownloadHistoryPolicy('unexpected'), 'errors_only');
});

test('errors-only compaction removes successful and skipped details but preserves failures', () => {
    assert.deepEqual(terminalStatusesToDelete('errors_only'), ['success', 'skipped']);
    assert.deepEqual(terminalStatusesToDelete('all'), []);
});

test('a completed task can derive success totals after compacted success rows are gone', async () => {
    const { mapTelegramChannelJob } = await import('./unifiedTaskMapper.js');
    const task = mapTelegramChannelJob({
        id: 'job-1', kind: 'date_range', source: '@demo', status: 'completed_with_errors', scan_status: 'done',
        total_count: 100, item_count: 2, completed_items: 0, failed_items: 2, skipped_count: 3, active_items: 0,
        params: {}, created_at: new Date(), updated_at: new Date(), finished_at: new Date(),
    }, new Map());
    assert.deepEqual(task.counts, { total: 100, completed: 95, failed: 2 });
    assert.equal(task.progress, 100);
});
