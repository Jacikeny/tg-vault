import type { StorageTargetSnapshot } from './storage.js';

export function resolveChannelJobTargetSnapshot(
    explicitTarget: StorageTargetSnapshot | undefined,
    getActiveTarget: () => StorageTargetSnapshot,
): StorageTargetSnapshot {
    return explicitTarget ?? getActiveTarget();
}
