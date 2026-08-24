import assert from 'node:assert/strict';
import test from 'node:test';
import {
    mapTelegramChannelJob,
    mapTransferTask,
    telegramChannelJobTaskState,
} from './unifiedTaskMapper.js';
import type { TransferTaskRecord } from './transferTasks.js';

const now = Date.parse('2026-08-24T00:00:00.000Z');

function channelRow(overrides: Record<string, unknown> = {}) {
    return {
        id: 'cafebabedeadbeef',
        user_id: 7,
        chat_id: '-100123',
        kind: 'tag_download',
        source: '@wallpaper',
        status: 'running',
        scan_status: 'scanning',
        download_status: 'active',
        total_count: 20,
        item_count: 20,
        pending_count: 10,
        downloading_count: 1,
        success_count: 7,
        failed_count: 1,
        skipped_count_items: 1,
        total_bytes: '1024',
        params: { tag: '#壁纸', storageProvider: 'local', folderOverride: '频道/壁纸' },
        created_at: new Date(now - 60_000).toISOString(),
        updated_at: new Date(now).toISOString(),
        finished_at: null,
        ...overrides,
    };
}

test('scan_status done maps an active channel job to downloading, never scanning', () => {
    assert.deepEqual(
        telegramChannelJobTaskState(channelRow({ scan_status: 'done' })),
        { status: 'running', stage: 'downloading' },
    );

    const task = mapTelegramChannelJob(channelRow({ scan_status: 'done' }), new Map());
    assert.equal(task.stage, 'downloading');
    assert.notEqual(task.stage, 'scanning');
});

test('channel status and scan phase map consistently across lifecycle states', () => {
    assert.deepEqual(telegramChannelJobTaskState(channelRow({ status: 'queued', scan_status: 'pending' })), {
        status: 'pending', stage: 'waiting',
    });
    assert.deepEqual(telegramChannelJobTaskState(channelRow({ status: 'running', scan_status: 'scanning' })), {
        status: 'running', stage: 'scanning',
    });
    assert.deepEqual(telegramChannelJobTaskState(channelRow({ status: 'completed', scan_status: 'done' })), {
        status: 'completed', stage: 'completed',
    });
    assert.deepEqual(telegramChannelJobTaskState(channelRow({ status: 'completed_with_errors', scan_status: 'done' })), {
        status: 'failed', stage: 'failed',
    });
    assert.deepEqual(telegramChannelJobTaskState(channelRow({ status: 'cancelled', scan_status: 'cancelled' })), {
        status: 'cancelled', stage: 'cancelled',
    });
});

test('retryable terminal transfer tasks remain cancellable so users can release their storage target', () => {
    const accounts = new Map([['account-a', '主存储']]);
    const transfer: TransferTaskRecord = {
        sourceType: 'telegram_bot', id: 'bot-failed', kind: 'single', title: 'report.pdf', status: 'interrupted',
        stage: 'retry_required', progress: 25, ownerUserId: 7, chatId: '-100123', source: 'Telegram',
        targetProvider: 'webdav', targetAccountId: 'account-a', targetFolder: '文档', totalItems: 1,
        completedItems: 0, failedItems: 1, totalBytes: 4096, transferredBytes: 1024,
        payload: {}, error: '服务重启', retryable: true, cancelRequested: false,
        startedAt: new Date(now - 30_000), finishedAt: new Date(now), createdAt: new Date(now - 60_000), updatedAt: new Date(now),
    };
    assert.equal(mapTransferTask(transfer, accounts).cancellable, true);
});

test('unified mappers preserve targets, counts, and task safety capabilities', () => {
    const accounts = new Map([['account-a', '主存储']]);
    const channel = mapTelegramChannelJob(channelRow({
        status: 'completed_with_errors',
        scan_status: 'done',
        params: JSON.stringify({ storageProvider: 'google_drive', storageAccountId: 'account-a', folderOverride: '归档' }),
    }), accounts);
    assert.deepEqual(channel.target, {
        provider: 'google_drive', accountId: 'account-a', accountName: '主存储', folder: '归档',
    });
    assert.deepEqual(channel.counts, { total: 20, completed: 7, failed: 1 });
    assert.equal(channel.retryable, true);
    assert.equal(channel.cancellable, false);

    const transfer: TransferTaskRecord = {
        sourceType: 'telegram_bot', id: 'bot-1', kind: 'single', title: 'report.pdf', status: 'running',
        stage: 'uploading', progress: 75, ownerUserId: 7, chatId: '-100123', source: 'Telegram',
        targetProvider: 'local', targetAccountId: null, targetFolder: '文档', totalItems: 1,
        completedItems: 0, failedItems: 0, totalBytes: 4096, transferredBytes: 3072,
        payload: { speed: '1 MiB/s' }, error: null, retryable: false, cancelRequested: false,
        startedAt: new Date(now - 30_000), finishedAt: null, createdAt: new Date(now - 60_000), updatedAt: new Date(now),
    };
    const task = mapTransferTask(transfer, accounts);
    assert.equal(task.sourceType, 'telegram_bot');
    assert.equal(task.target.accountName, '服务器本地目录');
    assert.equal(task.cancellable, true);
    assert.deepEqual(task.bytes, { total: 4096, transferred: 3072 });
});
