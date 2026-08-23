export type TelegramUploadReceiptAction =
    | 'find_folder'
    | 'copy_id'
    | 'delete_file'
    | 'retry_failed'
    | 'failure_details';

export interface TelegramUploadReceiptInput {
    taskId: string;
    fileName: string;
    provider: string;
    accountName: string;
    folder?: string | null;
    fileId?: string | null;
    duplicateOutcome?: 'copied' | 'skipped' | null;
    status: 'running' | 'success' | 'partial' | 'failed';
    total?: number;
    successful?: number;
    failed?: number;
}

export interface TelegramUploadReceipt {
    text: string;
    silentSingleCard: boolean;
    actions: Array<{ action: TelegramUploadReceiptAction; label: string; data: string }>;
}

export function buildUploadReceipt(input: TelegramUploadReceiptInput): TelegramUploadReceipt {
    const total = Math.max(1, input.total || 1);
    const failed = Math.max(0, input.failed || 0);
    const successful = Math.max(0, input.successful ?? (input.status === 'success' ? total : 0));
    const lines = [
        input.status === 'success' ? '✅ **文件已保存**' : input.status === 'partial' ? '⚠️ **批量任务部分完成**' : input.status === 'failed' ? '❌ **保存失败**' : '⏳ **正在处理**',
        `📄 ${input.fileName}`,
        `🎯 ${input.provider} / ${input.accountName}`,
        `📁 ${input.folder || '根目录'}`,
        input.fileId ? `🆔 ${input.fileId.slice(0, 13)}` : null,
        total > 1 ? `📊 共 ${total} · 成功 ${successful} · 失败 ${failed}` : null,
        input.duplicateOutcome === 'copied' ? '♻️ 重复处理：已生成副本' : input.duplicateOutcome === 'skipped' ? '⏭️ 重复处理：已跳过' : null,
        `任务：${input.taskId}`,
    ].filter(Boolean) as string[];
    const actions: TelegramUploadReceipt['actions'] = [];
    if (failed > 0 || input.status === 'failed') {
        actions.push({ action: 'retry_failed', label: '重试失败项', data: `receipt_retry_${input.taskId}` });
        actions.push({ action: 'failure_details', label: '查看失败明细', data: `receipt_failures_${input.taskId}` });
    } else if (input.status === 'success' && input.fileId) {
        actions.push({ action: 'find_folder', label: '搜索同目录', data: `receipt_find_${input.taskId}` });
        actions.push({ action: 'copy_id', label: '复制 ID', data: `receipt_copy_${input.taskId}` });
        actions.push({ action: 'delete_file', label: '删除该文件', data: `receipt_delete_${input.taskId}` });
    }
    return { text: lines.join('\n'), actions, silentSingleCard: total >= 9 };
}
