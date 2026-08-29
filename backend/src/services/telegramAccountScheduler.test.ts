import assert from 'node:assert/strict';
import test from 'node:test';
import { selectWeightedLeastConnectedTelegramAccount } from './telegramAccountScheduler.js';

const NOW = new Date('2026-08-29T08:00:00.000Z');

function candidate(accountId: string, overrides: Record<string, unknown> = {}) {
    return {
        accountId,
        enabled: true,
        healthState: 'healthy' as const,
        cooldownUntil: null,
        weight: 1,
        activeConnections: 0,
        maxConnections: 4,
        sourceAccessState: 'unknown' as const,
        ...overrides,
    };
}

test('scheduler excludes disabled, expired, cooling, denied, saturated and explicitly excluded accounts', () => {
    const selected = selectWeightedLeastConnectedTelegramAccount([
        candidate('disabled', { enabled: false }),
        candidate('expired', { healthState: 'session_expired' }),
        candidate('cooling', { cooldownUntil: '2026-08-29T08:00:01.000Z' }),
        candidate('denied', { sourceAccessState: 'denied' }),
        candidate('saturated', { activeConnections: 4 }),
        candidate('excluded'),
        candidate('available', { activeConnections: 2 }),
    ], { now: NOW, excludeAccountIds: ['excluded'] });

    assert.equal(selected?.accountId, 'available');
});

test('scheduler prefers known source access then applies weighted least connections', () => {
    const selected = selectWeightedLeastConnectedTelegramAccount([
        candidate('unknown-idle', { activeConnections: 0, sourceAccessState: 'unknown' }),
        candidate('allowed-heavy', { activeConnections: 3, weight: 2, sourceAccessState: 'allowed' }),
        candidate('allowed-light', { activeConnections: 2, weight: 2, sourceAccessState: 'allowed' }),
    ], { now: NOW });

    assert.equal(selected?.accountId, 'allowed-light');
});

test('scheduler uses deterministic priority and account id tie breakers and treats elapsed cooldown as runnable', () => {
    const selected = selectWeightedLeastConnectedTelegramAccount([
        candidate('z-account', { priority: 5, cooldownUntil: '2026-08-29T07:59:59.000Z' }),
        candidate('b-account', { priority: 10 }),
        candidate('a-account', { priority: 10 }),
    ], { now: NOW });

    assert.equal(selected?.accountId, 'a-account');
});

test('an idle account with a larger weight receives the first otherwise-equal connection', () => {
    assert.equal(selectWeightedLeastConnectedTelegramAccount([
        candidate('light', { weight: 1 }),
        candidate('heavy', { weight: 3 }),
    ], { now: NOW })?.accountId, 'heavy');
});
