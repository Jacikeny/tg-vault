import assert from 'node:assert/strict';
import test from 'node:test';
import { TelegramUserClientPool } from './telegramUserClientPool.js';

function account(id: string, overrides: Record<string, unknown> = {}) {
    return {
        id, telegramUserId: id, username: null, displayName: null, session: `session-${id}`,
        enabled: true, healthState: 'healthy' as const, cooldownUntil: null,
        weight: 1, priority: 0, maxConnections: 2, lastError: null,
        ...overrides,
    };
}

test('pool lazily connects eligible accounts, schedules by source permission and releases connection load', async () => {
    const rows = [account('a'), account('b')];
    const access = [{ accountId: 'b', sourceKey: '@news', scope: 'download' as const, accessState: 'allowed' as const, lastError: null, checkedAt: null }];
    const clients = new Map<string, any>();
    const repo: any = {
        migrateLegacySystemSettings: async () => null,
        listEnabledAccounts: async () => rows,
        listSourceAccess: async () => access,
        updateSession: async () => true,
        recordHealthy: async () => true,
        recordFailure: async () => true,
        markSessionExpired: async () => true,
    };
    const pool = new TelegramUserClientPool({
        repository: repo,
        decryptSession: (value: string) => value,
        saveSession: (client: any) => client.saveSession(),
        createClient: (session: string, _credentials: { apiId: number; apiHash: string }, accountId: string) => {
            const client = {
                connected: false,
                async connect() { this.connected = true; },
                async checkAuthorization() { return true; },
                async getMe() { return { id: accountId }; },
                saveSession() { return session; },
                async disconnect() { this.connected = false; },
                async destroy() {},
            };
            clients.set(accountId, client);
            return client;
        },
    });
    await pool.initialize({ apiId: 1, apiHash: 'hash' });
    const selected = await pool.select('@news');
    assert.equal(selected?.accountId, 'b');
    assert.equal(selected?.client, clients.get('b'));
    assert.equal(pool.getActiveConnections('b'), 1);
    selected?.release();
    selected?.release();
    assert.equal(pool.getActiveConnections('b'), 0);
    assert.deepEqual(pool.getRuntimeState().map((state: { accountId: string; connected: boolean; activeConnections: number }) => Object.keys(state).sort()), [
        ['accountId', 'activeConnections', 'connected'],
        ['accountId', 'activeConnections', 'connected'],
    ]);
});

test('pool records authorization expiry per account and continues with healthy accounts', async () => {
    const expired = account('expired', { priority: 100 });
    const healthy = account('healthy');
    const expiredMarks: string[] = [];
    const repo: any = {
        migrateLegacySystemSettings: async () => null,
        listEnabledAccounts: async () => [expired, healthy],
        listSourceAccess: async () => [],
        updateSession: async () => true,
        recordHealthy: async () => true,
        recordFailure: async () => true,
        markSessionExpired: async (id: string) => { expiredMarks.push(id); return true; },
    };
    const pool = new TelegramUserClientPool({
        repository: repo,
        decryptSession: (value: string) => value,
        saveSession: (client: any) => client.saveSession(),
        createClient: (_session: string, _credentials: { apiId: number; apiHash: string }, accountId: string): any => ({
            connected: false,
            async connect() { this.connected = true; },
            async checkAuthorization() { return accountId !== 'expired'; },
            async getMe() { return { id: accountId }; },
            saveSession() { return `saved-${accountId}`; },
            async disconnect() { this.connected = false; },
            async destroy() {},
        }),
    });
    await pool.initialize({ apiId: 1, apiHash: 'hash' });
    assert.deepEqual(expiredMarks, ['expired']);
    assert.equal((await pool.select('@any'))?.accountId, 'healthy');
});
