export interface StorageCapabilities {
    share: boolean;
    sharePassword: boolean;
    shareExpiration: boolean;
    quota: boolean;
    userDelete: boolean;
}

export function buildStorageCapabilities(provider: string): StorageCapabilities {
    switch (provider) {
        case 'onedrive':
            return { share: true, sharePassword: true, shareExpiration: true, quota: true, userDelete: true };
        case 'google_drive':
            return { share: true, sharePassword: false, shareExpiration: false, quota: true, userDelete: true };
        case 'openlist':
            return { share: false, sharePassword: false, shareExpiration: false, quota: false, userDelete: false };
        default:
            return { share: false, sharePassword: false, shareExpiration: false, quota: false, userDelete: true };
    }
}

export function buildStorageScopeForTarget(target: { providerName: string; accountId: string | null }): { clause: string; params: unknown[] } {
    if (target.providerName === 'local') return { clause: "source = 'local'", params: [] };
    if (!target.accountId) throw new Error('云存储统计缺少活动账户');
    return { clause: 'storage_account_id = $1', params: [target.accountId] };
}

export interface StorageHealthContract {
    probeStatus: 'available' | 'failed' | null;
    lastProbedAt: string | null;
    cooldownUntil: string | null;
    cooldownReason: string | null;
}

export function buildStorageStatsPayload(input: {
    disk: { totalBytes: number; freeBytes: number };
    indexed: { usedBytes: number; fileCount: number };
    remoteQuota: { totalBytes: number; usedBytes: number } | null;
    health: StorageHealthContract;
}) {
    const temporaryUsedBytes = Math.max(0, input.disk.totalBytes - input.disk.freeBytes);
    return {
        temporary: {
            totalBytes: input.disk.totalBytes,
            usedBytes: temporaryUsedBytes,
            freeBytes: input.disk.freeBytes,
            usedPercent: input.disk.totalBytes > 0 ? Math.round((temporaryUsedBytes / input.disk.totalBytes) * 100) : 0,
        },
        indexed: { ...input.indexed },
        remoteQuota: input.remoteQuota ? {
            ...input.remoteQuota,
            freeBytes: Math.max(0, input.remoteQuota.totalBytes - input.remoteQuota.usedBytes),
            usedPercent: input.remoteQuota.totalBytes > 0
                ? Math.round((input.remoteQuota.usedBytes / input.remoteQuota.totalBytes) * 100)
                : 0,
        } : null,
        health: { ...input.health },
    };
}
