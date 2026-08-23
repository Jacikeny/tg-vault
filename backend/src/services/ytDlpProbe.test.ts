import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import {
    buildYtDlpProbeArgs,
    parseYtDlpProbeOutput,
    runYtDlpProbe,
} from './ytDlpProbe.js';

class FakeChild extends EventEmitter {
    stdout = new PassThrough();
    stderr = new PassThrough();
    kills: string[] = [];
    kill(signal = 'SIGTERM') {
        this.kills.push(signal);
        this.emit('close', null);
        return true;
    }
}

test('probe arguments are metadata-only, single-item, and keep the URL behind --', () => {
    const args = buildYtDlpProbeArgs('https://video.example/watch?v=abc');
    assert.deepEqual(args, [
        '--dump-single-json', '--skip-download', '--no-playlist', '--no-warnings', '--',
        'https://video.example/watch?v=abc',
    ]);
    assert.equal(args.some(arg => /cookie/i.test(arg)), false);
});

test('metadata parser exposes bounded safe fields and rejects playlists', () => {
    assert.deepEqual(parseYtDlpProbeOutput(JSON.stringify({
        id: 'abc', title: 'A video', duration: 123, extractor_key: 'YouTube', webpage_url: 'https://example.test/v',
    })), {
        id: 'abc', title: 'A video', durationSeconds: 123, site: 'YouTube', webpageUrl: 'https://example.test/v', isPlaylist: false, playlistCount: null,
    });
    assert.throws(() => parseYtDlpProbeOutput(JSON.stringify({ _type: 'playlist', entries: [{ id: '1' }, { id: '2' }] })), /播放列表默认禁用/);
});

test('probe abort terminates the child and rejects without starting a download', async () => {
    const child = new FakeChild();
    const controller = new AbortController();
    const pending = runYtDlpProbe('https://example.test/video', {
        signal: controller.signal,
        assertUrl: async () => undefined,
        spawnProcess: (() => child) as any,
        timeoutMs: 5_000,
        maxOutputBytes: 1_024,
    });
    controller.abort('cancelled');
    await assert.rejects(pending, error => error instanceof Error && error.name === 'AbortError');
    assert.deepEqual(child.kills, ['SIGTERM']);
});

test('probe rejects output beyond the configured byte cap and kills the child', async () => {
    const child = new FakeChild();
    const pending = runYtDlpProbe('https://example.test/video', {
        assertUrl: async () => undefined,
        spawnProcess: (() => child) as any,
        timeoutMs: 5_000,
        maxOutputBytes: 32,
    });
    child.stdout.write('x'.repeat(33));
    await assert.rejects(pending, /输出超过限制/);
    assert.deepEqual(child.kills, ['SIGTERM']);
});
