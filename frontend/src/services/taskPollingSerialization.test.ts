import assert from 'node:assert/strict';
import test from 'node:test';
import { createSerialPoller } from './serialPoller.js';

function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>(done => { resolve = done; });
    return { promise, resolve };
}

test('poller schedules the next request only after the current request settles', async () => {
    const first = deferred();
    const scheduled: Array<() => void> = [];
    let calls = 0;
    const poller = createSerialPoller({
        run: async () => { calls += 1; if (calls === 1) await first.promise; },
        schedule: callback => { scheduled.push(callback); return callback; },
        cancel: () => undefined,
        delayMs: 5_000,
    });
    poller.start();
    await Promise.resolve();
    assert.equal(calls, 1);
    assert.equal(scheduled.length, 0);
    first.resolve();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(scheduled.length, 1);
    scheduled.shift()!();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, 2);
    poller.stop();
});

test('stopping during a request prevents another poll from being scheduled', async () => {
    const first = deferred();
    const scheduled: Array<() => void> = [];
    const poller = createSerialPoller({
        run: () => first.promise,
        schedule: callback => { scheduled.push(callback); return callback; },
        cancel: () => undefined,
        delayMs: 5_000,
    });
    poller.start();
    poller.stop();
    first.resolve();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(scheduled.length, 0);
});
