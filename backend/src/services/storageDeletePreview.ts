export interface StorageDeletePreviewQuery {
    text: string;
    values: string[];
}

export function buildStorageDeletePreviewQueries(accountId: string): {
    impact: StorageDeletePreviewQuery;
    leases: StorageDeletePreviewQuery;
    tasks: StorageDeletePreviewQuery;
    uploads: StorageDeletePreviewQuery;
} {
    return {
        impact: {
            text: `SELECT COUNT(*)::int AS file_count,
                          COALESCE(SUM(size), 0)::bigint AS total_size,
                          COUNT(DISTINCT folder) FILTER (WHERE folder IS NOT NULL AND folder <> '')::int AS folder_count,
                          encode(digest(COALESCE(string_agg(id::text, ',' ORDER BY id), ''), 'sha256'), 'hex') AS file_fingerprint
                   FROM files WHERE storage_account_id = $1::uuid`,
            values: [accountId],
        },
        leases: {
            text: `SELECT COUNT(*)::int AS count FROM storage_account_leases
                   WHERE storage_account_id = $1::uuid AND released_at IS NULL AND expires_at > NOW()`,
            values: [accountId],
        },
        tasks: {
            text: `SELECT COUNT(*)::int AS count FROM (
                       SELECT 'transfer:' || source_type || ':' || id AS ref
                       FROM transfer_tasks
                       WHERE target_account_id = $1::uuid
                         AND (status IN ('pending', 'running', 'paused', 'interrupted', 'retry_required') OR retryable = true)
                       UNION ALL
                       SELECT 'telegram-job:' || id::text AS ref
                       FROM telegram_background_jobs
                       WHERE finished_at IS NULL AND cancelled_at IS NULL
                         AND params->>'storageAccountId' = $1::text
                       UNION ALL
                       SELECT 'telegram-target:' || chat_id::text AS ref
                       FROM telegram_target_states
                       WHERE account_id = $1::uuid AND expires_at > NOW()
                       UNION ALL
                       SELECT 'subscription:' || id::text AS ref
                       FROM telegram_channel_subscriptions
                       WHERE target_mode = 'fixed' AND target_account_id = $1::uuid
                   ) active_references`,
            values: [accountId],
        },
        uploads: {
            text: `SELECT COUNT(*)::int AS count FROM chunk_upload_sessions
                   WHERE target_account_id = $1::uuid AND status IN ('open', 'completing', 'failed')`,
            values: [accountId],
        },
    };
}
