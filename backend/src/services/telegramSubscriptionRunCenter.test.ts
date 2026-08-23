import assert from 'node:assert/strict';
import test from 'node:test';
import {
    buildSubscriptionOperations,
    parseTelegramSubscriptionCallback,
    resolveSubscriptionTarget,
} from './telegramSubscriptionManagement.js';

const fixed = { target_mode: 'fixed', target_provider: 's3', target_account_id: 'account-a' };

test('subscription operations expose sync pause resume target cursor backfill results and retry', () => {
    const actions = buildSubscriptionOperations({ id: '00000000-0000-4000-8000-000000000001', enabled: true } as any);
    assert.deepEqual(actions.map(action => action.action), ['sync', 'pause', 'target', 'from_now', 'backfill', 'result', 'retry']);
    assert.deepEqual(parseTelegramSubscriptionCallback('tsub_sync_00000000-0000-4000-8000-000000000001_2'), { kind: 'action', action: 'sync', id: '00000000-0000-4000-8000-000000000001', page: 2 });
    assert.deepEqual(parseTelegramSubscriptionCallback('tsub_resume_00000000-0000-4000-8000-000000000001'), { kind: 'action', action: 'resume', id: '00000000-0000-4000-8000-000000000001', page: 0 });
});

test('subscription target mode snapshots global or fixed targets explicitly', () => {
    const global = { provider: { name: 'local' }, accountId: null, providerKey: 'local' } as any;
    const getTarget = (provider: string, accountId: string | null) => ({ provider: { name: provider }, accountId, providerKey: `${provider}:${accountId}` }) as any;
    assert.equal(resolveSubscriptionTarget({ target_mode: 'follow_global' } as any, () => global, getTarget), global);
    const target = resolveSubscriptionTarget(fixed as any, () => global, getTarget);
    assert.equal(target.provider.name, 's3');
    assert.equal(target.accountId, 'account-a');
});
