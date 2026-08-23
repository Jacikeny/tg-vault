export interface ScopedInteractionMapOptions {
    ttlMs?: number;
    maxEntries?: number;
    now?: () => number;
}

interface Entry<V> {
    value: V;
    createdAt: number;
    expiresAt: number;
}

export class ScopedInteractionMap<K, V> {
    private readonly entries = new Map<K, Entry<V>>();
    private readonly ttlMs: number;
    private readonly maxEntries: number;
    private readonly now: () => number;

    constructor(options: ScopedInteractionMapOptions = {}) {
        this.ttlMs = Math.max(1, options.ttlMs ?? 15 * 60_000);
        this.maxEntries = Math.max(1, options.maxEntries ?? 1_000);
        this.now = options.now ?? Date.now;
    }

    private evictForCapacity(): void {
        this.cleanup();
        while (this.entries.size >= this.maxEntries) {
            let oldest: K | undefined;
            let oldestTime = Number.POSITIVE_INFINITY;
            for (const [key, entry] of this.entries) {
                if (entry.createdAt < oldestTime) {
                    oldest = key;
                    oldestTime = entry.createdAt;
                }
            }
            if (oldest === undefined) break;
            this.entries.delete(oldest);
        }
    }

    set(key: K, value: V): this {
        const now = this.now();
        if (!this.entries.has(key)) this.evictForCapacity();
        this.entries.set(key, { value, createdAt: now, expiresAt: now + this.ttlMs });
        return this;
    }

    get(key: K): V | undefined {
        const entry = this.entries.get(key);
        if (!entry) return undefined;
        if (entry.expiresAt <= this.now()) {
            this.entries.delete(key);
            return undefined;
        }
        return entry.value;
    }

    has(key: K): boolean {
        return this.get(key) !== undefined;
    }

    touch(key: K): boolean {
        const value = this.get(key);
        if (value === undefined) return false;
        const entry = this.entries.get(key)!;
        entry.expiresAt = this.now() + this.ttlMs;
        return true;
    }

    delete(key: K): boolean {
        return this.entries.delete(key);
    }

    keys(): IterableIterator<K> {
        this.cleanup();
        return this.entries.keys();
    }

    values(): IterableIterator<V> {
        this.cleanup();
        return Array.from(this.entries.values(), entry => entry.value).values();
    }

    entriesIterator(): IterableIterator<[K, V]> {
        this.cleanup();
        return Array.from(this.entries, ([key, entry]) => [key, entry.value] as [K, V]).values();
    }

    cleanup(): number {
        const now = this.now();
        let removed = 0;
        for (const [key, entry] of this.entries) {
            if (entry.expiresAt <= now) {
                this.entries.delete(key);
                removed += 1;
            }
        }
        return removed;
    }

    clear(): void {
        this.entries.clear();
    }

    get size(): number {
        this.cleanup();
        return this.entries.size;
    }
}
