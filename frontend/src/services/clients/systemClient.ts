import type { UpdateStatus } from '../apiTypes';
import { apiRequest } from '../httpClient';
import { getApiHeaders } from './clientHeaders';

export class SystemClient {
    async getUpdateStatus(): Promise<UpdateStatus> {
        const response = await apiRequest('/api/system/update-status', {
            credentials: 'include',
            cache: 'no-store',
            headers: getApiHeaders(),
        });
        if (!response.ok) throw new Error('获取版本信息失败');
        return response.json();
    }

    async checkForUpdates(): Promise<UpdateStatus> {
        const response = await apiRequest('/api/system/update-check', {
            method: 'POST',
            credentials: 'include',
            cache: 'no-store',
            headers: getApiHeaders(),
        });
        if (response.status === 429) throw new Error('检查过于频繁，请稍后再试');
        if (!response.ok) throw new Error('检查版本失败');
        return response.json();
    }

    async healthCheck(): Promise<{ status: string; timestamp: string }> {
        const response = await apiRequest('/health');
        if (!response.ok) throw new Error('健康检查失败');
        return response.json();
    }
}

export const systemClient = new SystemClient();
