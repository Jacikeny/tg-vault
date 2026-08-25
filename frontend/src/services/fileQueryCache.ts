import type { FileData, FolderAggregation } from './api.js';

export interface FileQuerySnapshot {
    files: FileData[];
    folders: FolderAggregation[];
    nextCursor: string | null;
    hasMore: boolean;
}

export interface KeyValueStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

interface CacheEnvelope {
    version: 1;
    savedAt: number;
    entries: Record<string, { savedAt: number; snapshot: FileQuerySnapshot }>;
}

interface FileQueryCacheOptions {
    storage?: KeyValueStorage | null;
    now?: () => number;
    ttlMs?: number;
    maxEntries?: number;
    storageKey?: string;
}

const DEFAULT_STORAGE_KEY = 'tg-vault:file-query-cache:v1';

export class FileQueryCache {
    private readonly storage: KeyValueStorage | null;
    private readonly now: () => number;
    private readonly ttlMs: number;
    private readonly maxEntries: number;
    private readonly storageKey: string;
    private entries = new Map<string, { savedAt: number; snapshot: FileQuerySnapshot }>();

    constructor(options: FileQueryCacheOptions = {}) {
        this.storage = options.storage ?? null;
        this.now = options.now ?? Date.now;
        this.ttlMs = options.ttlMs ?? 30_000;
        this.maxEntries = options.maxEntries ?? 12;
        this.storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
        this.restore();
    }

    get(key: string): FileQuerySnapshot | null {
        const entry = this.entries.get(key);
        if (!entry) return null;
        if (this.now() - entry.savedAt > this.ttlMs) {
            this.entries.delete(key);
            this.persist();
            return null;
        }
        // Refresh insertion order so frequently used routes survive the bounded eviction.
        this.entries.delete(key);
        this.entries.set(key, entry);
        return entry.snapshot;
    }

    set(key: string, snapshot: FileQuerySnapshot): void {
        this.entries.delete(key);
        this.entries.set(key, { savedAt: this.now(), snapshot });
        while (this.entries.size > this.maxEntries) {
            const oldest = this.entries.keys().next().value as string | undefined;
            if (!oldest) break;
            this.entries.delete(oldest);
        }
        this.persist();
    }

    invalidate(): void {
        this.entries.clear();
        this.storage?.removeItem(this.storageKey);
    }

    private restore(): void {
        if (!this.storage) return;
        try {
            const raw = this.storage.getItem(this.storageKey);
            if (!raw) return;
            const envelope = JSON.parse(raw) as CacheEnvelope;
            if (envelope.version !== 1 || !envelope.entries || typeof envelope.entries !== 'object') return;
            const now = this.now();
            for (const [key, entry] of Object.entries(envelope.entries)) {
                if (entry && now - entry.savedAt <= this.ttlMs) this.entries.set(key, entry);
            }
        } catch {
            this.storage.removeItem(this.storageKey);
        }
    }

    private persist(): void {
        if (!this.storage) return;
        try {
            const entries = Object.fromEntries(this.entries);
            const envelope: CacheEnvelope = { version: 1, savedAt: this.now(), entries };
            this.storage.setItem(this.storageKey, JSON.stringify(envelope));
        } catch {
            // Browsing must continue when sessionStorage is unavailable or full.
        }
    }
}

export function createBrowserFileQueryCache(): FileQueryCache {
    let storage: KeyValueStorage | null = null;
    try {
        storage = window.sessionStorage;
    } catch {
        storage = null;
    }
    return new FileQueryCache({ storage });
}
