import crypto from 'node:crypto';
import type { StorageTargetSnapshot } from './storage.js';
import type { YtDlpProbeResult } from './ytDlpProbe.js';

export interface YtDlpConfirmationValue {
    actorId: number;
    chatKey: string;
    messageId: number;
    url: string;
    metadata: YtDlpProbeResult;
    target: StorageTargetSnapshot;
    format: 'best' | 'audio';
    folder: string;
    expiresAt: number;
}

export class YtDlpConfirmationStore {
    private readonly values = new Map<string, YtDlpConfirmationValue>();
    private readonly ttlMs: number;
    private readonly maxEntries: number;
    private readonly now: () => number;
    private readonly tokenFactory: () => string;

    constructor(options: { ttlMs?: number; maxEntries?: number; now?: () => number; tokenFactory?: () => string } = {}) {
        this.ttlMs = Math.max(1, options.ttlMs ?? 5 * 60_000);
        this.maxEntries = Math.max(1, options.maxEntries ?? 500);
        this.now = options.now ?? Date.now;
        this.tokenFactory = options.tokenFactory ?? (() => crypto.randomBytes(12).toString('base64url'));
    }

    private cleanup(): void {
        const now = this.now();
        for (const [token, value] of this.values) if (value.expiresAt <= now) this.values.delete(token);
        while (this.values.size >= this.maxEntries) this.values.delete(this.values.keys().next().value!);
    }

    issue(value: Omit<YtDlpConfirmationValue, 'expiresAt'>): { token: string; expiresAt: number } {
        this.cleanup();
        const token = this.tokenFactory();
        const expiresAt = this.now() + this.ttlMs;
        this.values.set(token, { ...value, expiresAt });
        return { token, expiresAt };
    }

    consume(token: string, binding: { actorId: number; chatKey: string; messageId: number }):
        | { status: 'ok'; value: YtDlpConfirmationValue }
        | { status: 'missing' | 'expired' | 'mismatch' } {
        const value = this.values.get(token);
        if (!value) return { status: 'missing' };
        if (value.expiresAt <= this.now()) {
            this.values.delete(token);
            return { status: 'expired' };
        }
        if (value.actorId !== binding.actorId || value.chatKey !== binding.chatKey || value.messageId !== binding.messageId) return { status: 'mismatch' };
        this.values.delete(token);
        return { status: 'ok', value };
    }

    cancel(token: string, binding: { actorId: number; chatKey: string; messageId: number }): boolean {
        const result = this.consume(token, binding);
        return result.status === 'ok';
    }
}
