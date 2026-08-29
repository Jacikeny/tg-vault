import type {
    CreateYtDlpTaskResult,
    TaskDismissalInput,
    TaskDismissalPreview,
    TaskDismissalResult,
    TaskFilters,
    UnifiedTaskList,
    UnifiedTaskSource,
} from '../apiTypes';
import { apiRequest } from '../httpClient';
import { getApiHeaders } from './clientHeaders';

export class TasksClient {
    async createYtDlpTask(input: { url: string; format: 'best' | 'audio' }): Promise<CreateYtDlpTaskResult> {
        const response = await apiRequest('/api/tasks/ytdlp', {
            credentials: 'include',
            method: 'POST',
            headers: getApiHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(input),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || '创建 yt-dlp 任务失败');
        return payload;
    }

    async getTasks(filters: TaskFilters = {}): Promise<UnifiedTaskList> {
        const params = new URLSearchParams({ limit: String(filters.limit ?? 200) });
        if (filters.source) params.set('source', filters.source);
        if (filters.status) params.set('status', filters.status);
        if (filters.accountId) params.set('accountId', filters.accountId);
        const response = await apiRequest(`/api/tasks?${params.toString()}`, {
            credentials: 'include',
            headers: getApiHeaders(),
        });
        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.error || '获取任务列表失败');
        }
        return response.json();
    }

    async controlTask(sourceType: UnifiedTaskSource, id: string, action: 'cancel' | 'retry'): Promise<void> {
        const sourcePath = encodeURIComponent(sourceType);
        const taskPath = encodeURIComponent(id);
        let confirmationToken: string | undefined;
        if (action === 'cancel') {
            const confirmation = await apiRequest(`/api/tasks/${sourcePath}/${taskPath}/cancel-confirmation`, {
                credentials: 'include',
                method: 'POST',
                headers: getApiHeaders(),
            });
            const payload = await confirmation.json().catch(() => ({}));
            if (!confirmation.ok || !payload.confirmationToken) {
                throw new Error(payload.error || '无法创建任务取消确认');
            }
            confirmationToken = String(payload.confirmationToken);
        }
        const response = await apiRequest(`/api/tasks/${sourcePath}/${taskPath}/${action}`, {
            credentials: 'include',
            method: 'POST',
            headers: getApiHeaders({
                'Content-Type': 'application/json',
                ...(confirmationToken ? { 'X-Confirmation-Token': confirmationToken } : {}),
            }),
        });
        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.message || payload.error || '任务操作失败');
        }
    }

    async prepareTaskDismissal(input: TaskDismissalInput): Promise<TaskDismissalPreview> {
        const response = await apiRequest('/api/tasks/dismissals/prepare', {
            credentials: 'include',
            method: 'POST',
            headers: getApiHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(input),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || '无法创建任务删除预览');
        return payload;
    }

    async confirmTaskDismissal(preview: TaskDismissalPreview): Promise<TaskDismissalResult> {
        const response = await apiRequest('/api/tasks/dismissals/confirm', {
            credentials: 'include',
            method: 'POST',
            headers: getApiHeaders({
                'Content-Type': 'application/json',
                'X-Confirmation-Token': preview.confirmationToken,
            }),
            body: JSON.stringify({ snapshotId: preview.snapshotId, context: preview.context }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok && response.status !== 207) throw new Error(payload.error || '删除任务记录失败');
        return payload;
    }
}

export const tasksClient = new TasksClient();
