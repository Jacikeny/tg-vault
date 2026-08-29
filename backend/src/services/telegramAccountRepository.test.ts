import assert from 'node:assert/strict';
import test from 'node:test';
import {
    TelegramAccountRepository,
    type TelegramAccountQueryClient,
} from './telegramAccountRepository.js';

class ScriptedDb implements TelegramAccountQueryClient {
    calls: Array<{ text: string; params: readonly unknown[] }> = [];
    constructor(private replies: Array<{ rows?: any[]; rowCount?: number }> = []) {}
    async query(text: string, params: readonly unknown[] = []) {
        this.calls.push({ text, params });
        const reply = this.replies.shift() || {};
        return { rows: reply.rows || [], rowCount: reply.rowCount ?? reply.rows?.length ?? 0 };
    }
}

test('legacy single-account migration is an idempotent insert-select and keeps the encrypted session', async () => {
    const db = new ScriptedDb([{ rows: [{ id: 'legacy-account' }], rowCount: 1 }]);
    const repo = new TelegramAccountRepository(db);
    assert.equal(await repo.migrateLegacySystemSettings(), 'legacy-account');
    assert.match(db.calls[0].text, /INSERT INTO telegram_user_accounts/);
    assert.match(db.calls[0].text, /system_settings/);
    assert.match(db.calls[0].text, /NOT EXISTS/);
    assert.match(db.calls[0].text, /telegram_user_session/);
});

test('source probe and attempt lifecycle persist account-scoped state', async () => {
    const db = new ScriptedDb([
        { rows: [{ account_id: 'a', source_key: '@news', scope: 'download', access_state: 'allowed' }] },
        { rows: [{ id: 'attempt-1' }] },
        { rowCount: 1 },
    ]);
    const repo = new TelegramAccountRepository(db);
    const access = await repo.markSourceAccess('a', '@news', 'download', 'allowed');
    const attempt = await repo.startDownloadAttempt({ accountId: 'a', sourceKey: '@news', scope: 'download' });
    assert.equal(access.accessState, 'allowed');
    assert.equal(attempt, 'attempt-1');
    assert.equal(await repo.finishDownloadAttempt(attempt, 'succeeded'), true);
    assert.match(db.calls[0].text, /ON CONFLICT \(account_id, source_key, scope\)/);
    assert.match(db.calls[1].text, /INSERT INTO telegram_download_attempts/);
    assert.match(db.calls[2].text, /finished_at = NOW\(\)/);
});

test('cooldown and session expiry are account-local health updates', async () => {
    const db = new ScriptedDb([{ rowCount: 1 }, { rowCount: 1 }]);
    const repo = new TelegramAccountRepository(db);
    assert.equal(await repo.markCooldown('a', 42, 'FLOOD_WAIT_42'), true);
    assert.equal(await repo.markSessionExpired('b', 'AUTH_KEY_UNREGISTERED'), true);
    assert.match(db.calls[0].text, /cooldown_until/);
    assert.deepEqual(db.calls[0].params, ['a', 42, 'FLOOD_WAIT_42']);
    assert.match(db.calls[1].text, /session_expired/);
});
