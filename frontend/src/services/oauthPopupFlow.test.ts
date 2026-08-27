import assert from 'node:assert/strict';
import test from 'node:test';
import { monitorOAuthPopup, type OAuthPopupFlowState } from './oauthPopupFlow.js';

function fixture() {
    let listener: ((event: MessageEvent) => void) | null = null;
    let interval: (() => void) | null = null;
    let removeCount = 0;
    let clearCount = 0;
    const states: OAuthPopupFlowState[] = [];
    const popup = { closed: false };
    const host = {
        addEventListener: (_type: 'message', value: (event: MessageEvent) => void) => { listener = value; },
        removeEventListener: () => { removeCount += 1; listener = null; },
        setInterval: (callback: () => void) => { interval = callback; return 7; },
        clearInterval: () => { clearCount += 1; interval = null; },
    };
    return {
        host, popup, states,
        emit: (data: unknown) => listener?.({ data } as MessageEvent),
        poll: () => interval?.(),
        counts: () => ({ removeCount, clearCount }),
    };
}

test('a trusted success is the only path that runs completion and resources are removed once', async () => {
    const f = fixture();
    let successCount = 0;
    monitorOAuthPopup({
        host: f.host, popup: f.popup,
        classifyMessage: event => event.data === 'trusted' ? 'success' : null,
        onSuccess: async () => { successCount += 1; },
        onStateChange: state => { f.states.push(state); },
    });
    f.emit('untrusted');
    f.emit('trusted');
    await new Promise(resolve => setImmediate(resolve));
    f.emit('trusted');
    assert.equal(successCount, 1);
    assert.deepEqual(f.states, ['waiting', 'success']);
    assert.deepEqual(f.counts(), { removeCount: 1, clearCount: 1 });
});

test('closing the popup without success reports cancellation and preserves the form path', async () => {
    const f = fixture();
    let successCount = 0;
    monitorOAuthPopup({
        host: f.host, popup: f.popup,
        classifyMessage: () => null,
        onSuccess: () => { successCount += 1; },
        onStateChange: state => { f.states.push(state); },
    });
    f.popup.closed = true;
    f.poll();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(successCount, 0);
    assert.deepEqual(f.states, ['waiting', 'cancelled']);
    assert.deepEqual(f.counts(), { removeCount: 1, clearCount: 1 });
});

test('completion failures become a failed terminal state', async () => {
    const f = fixture();
    monitorOAuthPopup({
        host: f.host, popup: f.popup,
        classifyMessage: () => 'success',
        onSuccess: async () => { throw new Error('reload failed'); },
        onStateChange: state => { f.states.push(state); },
    });
    f.emit('trusted');
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(f.states, ['waiting', 'failed']);
});
