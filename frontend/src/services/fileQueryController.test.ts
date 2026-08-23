import assert from 'node:assert/strict';
import test from 'node:test';
import { FileQueryController } from './fileQueryController.js';

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test('each settled query executes exactly one files and aggregation request group', async () => {
    const calls: string[] = [];
    const controller = new FileQueryController({ debounceMs: 5 });
    controller.schedule('alpha', async signal => {
        await Promise.all([
            Promise.resolve().then(() => calls.push(`files:${signal.aborted}`)),
            Promise.resolve().then(() => calls.push(`folders:${signal.aborted}`)),
        ]);
        return 'alpha-result';
    });
    await new Promise(resolve => setTimeout(resolve, 15));
    assert.deepEqual(calls, ['files:false', 'folders:false']);
    assert.equal(controller.currentValue, 'alpha-result');
});

test('debounce submits only the latest search text', async () => {
    const submitted: string[] = [];
    const controller = new FileQueryController({ debounceMs: 10 });
    for (const query of ['a', 'ab', 'abc']) {
        controller.schedule(query, async () => { submitted.push(query); return query; });
    }
    await new Promise(resolve => setTimeout(resolve, 25));
    assert.deepEqual(submitted, ['abc']);
    assert.equal(controller.currentValue, 'abc');
});

test('refresh starts a new generation, aborts old work, and retains prior value until success', async () => {
    let resolveRefresh!: (value: string) => void;
    const controller = new FileQueryController<string>({ debounceMs: 0, initialValue: 'old-list' });
    controller.schedule('first', async signal => new Promise<string>((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))));
    await tick();
    const pending = controller.refresh(async () => new Promise(resolve => { resolveRefresh = resolve; }));
    assert.equal(controller.currentValue, 'old-list');
    resolveRefresh('new-list');
    await pending;
    assert.equal(controller.currentValue, 'new-list');
});
