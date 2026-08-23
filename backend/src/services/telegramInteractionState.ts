import { canonicalTelegramChatKey } from '../utils/telegramChatKey.js';

export interface TelegramInteractionRecord<T> {
    userId: number;
    chatKey: string;
    kind: string;
    step: string;
    originMessageId?: number;
    createdAt: number;
    expiresAt: number;
    value: T;
}

export interface TelegramInteractionInput<T> {
    userId: number;
    chatKey: string;
    kind: string;
    step: string;
    originMessageId?: number;
    value: T;
}

interface TelegramInteractionStoreOptions {
    ttlMs?: number;
    maxEntries?: number;
    now?: () => number;
}

export type TelegramCallbackValidation =
    | { ok: true; record: TelegramInteractionRecord<unknown> }
    | { ok: false; reason: 'expired-or-missing' | 'message-mismatch' | 'action-not-allowed' };

export class TelegramInteractionStore<T> {
    private readonly entries = new Map<string, TelegramInteractionRecord<T>>();
    private readonly ttlMs: number;
    private readonly maxEntries: number;
    private readonly now: () => number;

    constructor(options: TelegramInteractionStoreOptions = {}) {
        this.ttlMs = Math.max(1, options.ttlMs ?? 15 * 60_000);
        this.maxEntries = Math.max(1, options.maxEntries ?? 1_000);
        this.now = options.now ?? Date.now;
    }

    private key(userId: number, chatKey: string): string {
        return `${userId}:${canonicalTelegramChatKey(chatKey)}`;
    }

    private removeExpired(now = this.now()): number {
        let removed = 0;
        for (const [key, value] of this.entries) {
            if (value.expiresAt <= now) {
                this.entries.delete(key);
                removed += 1;
            }
        }
        return removed;
    }

    private enforceCapacity(): void {
        while (this.entries.size >= this.maxEntries) {
            let oldestKey: string | undefined;
            let oldestCreatedAt = Number.POSITIVE_INFINITY;
            for (const [key, value] of this.entries) {
                if (value.createdAt < oldestCreatedAt) {
                    oldestCreatedAt = value.createdAt;
                    oldestKey = key;
                }
            }
            if (!oldestKey) break;
            this.entries.delete(oldestKey);
        }
    }

    set(input: TelegramInteractionInput<T>): TelegramInteractionRecord<T> {
        const now = this.now();
        this.removeExpired(now);
        const key = this.key(input.userId, input.chatKey);
        if (!this.entries.has(key)) this.enforceCapacity();
        const record: TelegramInteractionRecord<T> = {
            ...input,
            chatKey: canonicalTelegramChatKey(input.chatKey),
            createdAt: now,
            expiresAt: now + this.ttlMs,
        };
        this.entries.set(key, record);
        return record;
    }

    lookup(userId: number, chatKey: string):
        | { status: 'active'; record: TelegramInteractionRecord<T> }
        | { status: 'expired' }
        | { status: 'missing' } {
        const key = this.key(userId, chatKey);
        const record = this.entries.get(key);
        if (!record) return { status: 'missing' };
        if (record.expiresAt <= this.now()) {
            this.entries.delete(key);
            return { status: 'expired' };
        }
        return { status: 'active', record };
    }

    get(userId: number, chatKey: string): TelegramInteractionRecord<T> | undefined {
        const result = this.lookup(userId, chatKey);
        return result.status === 'active' ? result.record : undefined;
    }

    update(
        userId: number,
        chatKey: string,
        input: { kind: string; step: string; value: T; originMessageId?: number },
    ): TelegramInteractionRecord<T> | undefined {
        const current = this.lookup(userId, chatKey);
        if (current.status !== 'active') return undefined;
        const now = this.now();
        const record: TelegramInteractionRecord<T> = {
            ...current.record,
            kind: input.kind,
            step: input.step,
            value: input.value,
            originMessageId: input.originMessageId ?? current.record.originMessageId,
            expiresAt: now + this.ttlMs,
        };
        this.entries.set(this.key(userId, chatKey), record);
        return record;
    }

    delete(userId: number, chatKey: string): boolean {
        return this.entries.delete(this.key(userId, chatKey));
    }

    cleanup(): number {
        return this.removeExpired();
    }

    validateCallback(input: {
        userId: number;
        chatKey: string;
        messageId: number;
        action: string;
        allowedActions: readonly string[];
    }): TelegramCallbackValidation {
        const record = this.get(input.userId, input.chatKey);
        if (!record) return { ok: false, reason: 'expired-or-missing' };
        if (record.originMessageId !== input.messageId) return { ok: false, reason: 'message-mismatch' };
        if (!input.allowedActions.includes(input.action)) return { ok: false, reason: 'action-not-allowed' };
        return { ok: true, record: record as TelegramInteractionRecord<unknown> };
    }

    get size(): number {
        this.removeExpired();
        return this.entries.size;
    }
}
