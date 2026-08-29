import { query } from '../db/index.js';
import type { QueryResult } from 'pg';
import { getConfiguredTelegramAllowedUsers } from '../utils/authSettings.js';
import { ScopedInteractionMap } from './scopedInteractionMap.js';

// Telegram User States
export enum TelegramUserState {
    IDLE = 'IDLE',
    WAITING_2FA_LOGIN = 'WAITING_2FA_LOGIN',
    WAITING_2FA_SETUP = 'WAITING_2FA_SETUP',
}

const INTERACTION_TTL_MS = Math.max(60_000, Number.parseInt(process.env.TELEGRAM_INTERACTION_TTL_MS || '900000', 10) || 900_000);
const INTERACTION_MAX_ENTRIES = Math.max(10, Number.parseInt(process.env.TELEGRAM_INTERACTION_MAX_ENTRIES || '1000', 10) || 1_000);

// PIN / TOTP states are temporary and intentionally vanish after restart.
export const userStates = new ScopedInteractionMap<number, {
    state: TelegramUserState;
    qrMessageId?: number;
    promptMessageId?: number;
}>({ ttlMs: INTERACTION_TTL_MS, maxEntries: INTERACTION_MAX_ENTRIES });

// Authenticated user storage (Cache)
export const authenticatedUsers = new Map<number, { authenticatedAt: Date }>();

// Password input state
export const passwordInputState = new ScopedInteractionMap<number, { password: string }>({ ttlMs: INTERACTION_TTL_MS, maxEntries: INTERACTION_MAX_ENTRIES });

type TelegramRevokeQuery = (sql: string, params?: unknown[]) => Promise<Pick<QueryResult, 'rows' | 'rowCount'>>;

export async function revokeAuthenticatedUser(
    userId: number,
    dependencies: { query?: TelegramRevokeQuery; cache?: Map<number, { authenticatedAt: Date }> } = {},
): Promise<void> {
    const runQuery = dependencies.query || (query as TelegramRevokeQuery);
    const cache = dependencies.cache || authenticatedUsers;
    await runQuery('DELETE FROM telegram_auth WHERE user_id = $1', [userId]);
    cache.delete(userId);
}

export interface TelegramAllowlistReconciliationResult {
    allowed: number[];
    added: number[];
    removed: number[];
    revoked: number[];
    recipients: number[];
}

type TelegramStateQuery = (sql: string, params?: unknown[]) => Promise<Pick<QueryResult, 'rows' | 'rowCount'>>;

export async function reconcileTelegramAllowedUsers(
    userIds: number[],
    dependencies: {
        query?: TelegramStateQuery;
        cache?: Map<number, { authenticatedAt: Date }>;
    } = {},
): Promise<TelegramAllowlistReconciliationResult> {
    const allowed = [...new Set(userIds.filter(id => Number.isSafeInteger(id) && id > 0))].sort((a, b) => a - b);
    const runQuery: TelegramStateQuery = dependencies.query || (query as TelegramStateQuery);
    const cache = dependencies.cache || authenticatedUsers;
    const existing = await runQuery('SELECT user_id FROM telegram_auth ORDER BY user_id');
    const authenticated = existing.rows.map(row => Number(row.user_id)).filter(Number.isSafeInteger);
    const allowedSet = new Set(allowed);
    const authenticatedSet = new Set(authenticated);
    const added = allowed.filter(id => !authenticatedSet.has(id));
    const removed = authenticated.filter(id => !allowedSet.has(id)).sort((a, b) => a - b);
    const revokedResult = await runQuery(
        `DELETE FROM telegram_auth
         WHERE NOT (user_id = ANY($1::bigint[]))
         RETURNING user_id`,
        [allowed],
    );
    const revoked = revokedResult.rows.map(row => Number(row.user_id)).filter(Number.isSafeInteger).sort((a, b) => a - b);
    for (const userId of new Set([...removed, ...revoked])) cache.delete(userId);
    const recipients = [...cache.keys()].filter(id => allowedSet.has(id)).sort((a, b) => a - b);
    return { allowed, added, removed, revoked, recipients };
}

export async function loadAuthenticatedUsers(): Promise<void> {
    try {
        const allowedUsers = await getConfiguredTelegramAllowedUsers();
        const result = await query('SELECT user_id, authenticated_at FROM telegram_auth');
        for (const row of result.rows) {
            const userId = Number(row.user_id);
            if (allowedUsers.length > 0 && !allowedUsers.includes(userId)) {
                await revokeAuthenticatedUser(userId);
                continue;
            }
            authenticatedUsers.set(userId, { authenticatedAt: new Date(row.authenticated_at) });
        }
        console.log(`🤖 已从数据库载入 ${authenticatedUsers.size} 个授权用户`);
    } catch (error) {
        console.error('🤖 载入已验证用户失败:', error);
    }
}

// Persist authenticated user to database
export async function persistAuthenticatedUser(userId: number): Promise<void> {
    try {
        await query('INSERT INTO telegram_auth (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [userId]);
        authenticatedUsers.set(userId, { authenticatedAt: new Date() });
        console.log(`🤖 用户 ${userId} 已持久化到数据库`);
    } catch (error) {
        console.error('🤖 持久化用户失败:', error);
    }
}

// Fast cache-only check for legacy callers. Prefer isAuthenticatedAsync for command/callback authorization.
export function isAuthenticated(userId: number): boolean {
    return authenticatedUsers.has(userId);
}

// Check if user is authenticated and still allowed by env/DB allowlist.
export async function isAuthenticatedAsync(userId: number): Promise<boolean> {
    const allowedUsers = await getConfiguredTelegramAllowedUsers();
    if (allowedUsers.length > 0 && !allowedUsers.includes(userId)) {
        if (authenticatedUsers.has(userId)) await revokeAuthenticatedUser(userId);
        return false;
    }
    return authenticatedUsers.has(userId);
}
