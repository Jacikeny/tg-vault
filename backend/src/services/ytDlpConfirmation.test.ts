import assert from 'node:assert/strict';
import test from 'node:test';
import { YtDlpConfirmationStore } from './ytDlpConfirmation.js';

const target = { provider: { name: 'local' }, accountId: null, providerKey: 'local' } as any;

test('confirmation is bound to actor chat message and immutable target snapshot', () => {
    let now = 1_000;
    const store = new YtDlpConfirmationStore({ ttlMs: 500, maxEntries: 10, now: () => now, tokenFactory: () => 'token-a' });
    const value = store.issue({ actorId: 7, chatKey: '-1001', messageId: 42, url: 'https://example.test/v', metadata: { title: 'Video' } as any, target, format: 'best', folder: 'ytdlp' });
    assert.equal(value.token, 'token-a');
    assert.equal(store.consume('token-a', { actorId: 8, chatKey: '-1001', messageId: 42 }).status, 'mismatch');
    const consumed = store.consume('token-a', { actorId: 7, chatKey: '-1001', messageId: 42 });
    assert.equal(consumed.status, 'ok');
    if (consumed.status === 'ok') assert.equal(consumed.value.target, target);
    assert.equal(store.consume('token-a', { actorId: 7, chatKey: '-1001', messageId: 42 }).status, 'missing');
});

test('confirmation expires and can be cancelled without creating a task', () => {
    let now = 0;
    const store = new YtDlpConfirmationStore({ ttlMs: 100, now: () => now, tokenFactory: () => 'token-b' });
    store.issue({ actorId: 7, chatKey: '1', messageId: 1, url: 'https://example.test/v', metadata: { title: 'Video' } as any, target, format: 'audio', folder: 'music' });
    now = 101;
    assert.equal(store.consume('token-b', { actorId: 7, chatKey: '1', messageId: 1 }).status, 'expired');
});
