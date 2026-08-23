import assert from 'node:assert/strict';
import test from 'node:test';
import { ScopedInteractionMap } from './scopedInteractionMap.js';

test('scoped map expires entries and enforces capacity', () => {
    let now = 0;
    const map = new ScopedInteractionMap<string, { value: string }>({ ttlMs: 1_000, maxEntries: 2, now: () => now });
    map.set('a', { value: 'a' });
    now = 1;
    map.set('b', { value: 'b' });
    now = 2;
    map.set('c', { value: 'c' });
    assert.equal(map.get('a'), undefined);
    assert.equal(map.size, 2);
    now = 1_001;
    assert.equal(map.get('b'), undefined);
    assert.equal(map.get('c')?.value, 'c');
});

test('touch refreshes TTL while delete and cleanup are explicit', () => {
    let now = 10;
    const map = new ScopedInteractionMap<number, string>({ ttlMs: 100, maxEntries: 2, now: () => now });
    map.set(1, 'pin');
    now = 90;
    assert.equal(map.touch(1), true);
    now = 111;
    assert.equal(map.get(1), 'pin');
    assert.equal(map.delete(1), true);
    assert.equal(map.cleanup(), 0);
});
