import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
const download = fs.readFileSync(new URL('./ytDlpDownload.ts', import.meta.url), 'utf8');

test('production yt-dlp keeps playlists disabled unless bounded selection is persisted', () => {
    assert.match(download, /const args = playlist[\s\S]*buildYtDlpPlaylistArgs/);
    assert.match(download, /: \['--no-playlist'/);
    assert.match(download, /playlist: options\.playlist/);
    assert.match(download, /YtDlpPlaylistSelectionInput/);
});
