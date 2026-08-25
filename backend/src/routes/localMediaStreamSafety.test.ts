import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('./files.ts', import.meta.url), 'utf8');

function localStreamBody(): string {
    return source.slice(source.indexOf('async function serveLocalPathWithRange'), source.indexOf('async function serveCloudMediaStream'));
}

test('local media streaming awaits pipeline so asynchronous read errors are handled by the route', () => {
    assert.match(source, /node:stream\/promises/);
    assert.match(localStreamBody(), /await pipeline\(stream, res\)/);
    assert.doesNotMatch(localStreamBody(), /createReadStream\([^\n]*\)\.pipe\(res\)/);
});

test('local media streaming destroys the source when the client aborts', () => {
    assert.match(localStreamBody(), /req\.once\(['"]aborted['"],\s*\(\)\s*=>\s*stream\.destroy\(\)\)/);
});

test('thumbnail streaming uses the same error-aware local streaming helper', () => {
    const thumbnailRoute = source.slice(source.indexOf('// 获取缩略图'), source.indexOf('// 为单文件物理删除'));
    assert.match(thumbnailRoute, /await serveLocalPathWithRange\(/);
    assert.doesNotMatch(thumbnailRoute, /createReadStream/);
});
