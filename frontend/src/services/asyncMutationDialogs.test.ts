import assert from 'node:assert/strict';
import test from 'node:test';
import { performAsyncMutation } from './asyncMutation.js';

test('async mutation closes and clears input only after success', async () => {
    const events: string[] = [];
    const succeeded = await performAsyncMutation({
        action: async () => { events.push('request'); return 'created'; },
        onSuccess: result => events.push(`close:${result}`),
        onFailure: () => events.push('error'),
        onSettled: () => events.push('idle'),
    });
    assert.equal(succeeded, true);
    assert.deepEqual(events, ['request', 'close:created', 'idle']);
});

test('async mutation preserves the modal state after failure', async () => {
    const events: string[] = [];
    const error = new Error('server rejected the move');
    const succeeded = await performAsyncMutation({
        action: async () => { throw error; },
        onSuccess: () => events.push('close'),
        onFailure: caught => events.push(`error:${(caught as Error).message}`),
        onSettled: () => events.push('idle'),
    });
    assert.equal(succeeded, false);
    assert.deepEqual(events, ['error:server rejected the move', 'idle']);
});
