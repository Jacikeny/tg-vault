import type { StorageStats } from './api.js';

export class StorageStatisticsSynchronization {
    private generation = 0;

    begin(expectedAccountId: string | null | undefined) {
        const generation = ++this.generation;
        return {
            accept: (stats: StorageStats): boolean => {
                if (generation !== this.generation) return false;
                return expectedAccountId === undefined || stats.accountId === expectedAccountId;
            },
        };
    }

    invalidate(): void {
        this.generation += 1;
    }
}
