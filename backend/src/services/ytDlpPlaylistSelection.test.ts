import assert from 'node:assert/strict';
import test from 'node:test';
import { buildYtDlpPlaylistArgs, validateYtDlpPlaylistSelection } from './ytDlpPlaylistSelection.js';

test('playlist selection must be explicit, bounded, and inside budget', () => {
    assert.throws(() => validateYtDlpPlaylistSelection({ enabled: false, start: 1, end: 2, maxItems: 2 }), /显式启用/);
    assert.throws(() => validateYtDlpPlaylistSelection({ enabled: true, start: 10, end: 2, maxItems: 5 }), /范围/);
    assert.throws(() => validateYtDlpPlaylistSelection({ enabled: true, start: 1, end: 1000, maxItems: 1000 }), /上限/);
    const selected = validateYtDlpPlaylistSelection({ enabled: true, start: 2, end: 10, maxItems: 9 }, { hardMaxItems: 25, maxBudgetBytes: 900, estimatedItemBytes: 100 });
    assert.equal(selected.count, 9);
});

test('playlist args retain URL argument boundary and server-enforced range', () => {
    const args = buildYtDlpPlaylistArgs('https://example.test/list', { enabled: true, start: 2, end: 4, maxItems: 3 });
    assert.deepEqual(args.slice(0, 6), ['--yes-playlist', '--playlist-start', '2', '--playlist-end', '4', '--max-downloads']);
    assert.equal(args.at(-2), '--');
    assert.equal(args.at(-1), 'https://example.test/list');
});
