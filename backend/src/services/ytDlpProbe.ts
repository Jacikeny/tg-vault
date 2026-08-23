import os from 'node:os';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { assertPublicHttpUrl } from '../utils/networkSecurity.js';

const YTDLP_BIN = process.env.YTDLP_BIN || 'yt-dlp';

export interface YtDlpProbeResult {
    id: string;
    title: string;
    durationSeconds: number | null;
    site: string;
    webpageUrl: string;
    isPlaylist: boolean;
    playlistCount: number | null;
}

export function buildYtDlpProbeArgs(url: string): string[] {
    return ['--dump-single-json', '--skip-download', '--no-playlist', '--no-warnings', '--', url];
}

export function parseYtDlpProbeOutput(output: string): YtDlpProbeResult {
    let parsed: any;
    try {
        parsed = JSON.parse(output);
    } catch {
        throw new Error('yt-dlp 返回了无效元数据');
    }
    const entries = Array.isArray(parsed?.entries) ? parsed.entries : null;
    const isPlaylist = parsed?._type === 'playlist' || Boolean(entries);
    if (isPlaylist) throw new Error('播放列表默认禁用；请显式启用并指定范围与最大条目');
    return {
        id: String(parsed?.id || ''),
        title: String(parsed?.title || '未命名媒体').slice(0, 300),
        durationSeconds: Number.isFinite(Number(parsed?.duration)) ? Math.max(0, Number(parsed.duration)) : null,
        site: String(parsed?.extractor_key || parsed?.extractor || 'unknown').slice(0, 100),
        webpageUrl: String(parsed?.webpage_url || parsed?.original_url || '').slice(0, 2_000),
        isPlaylist: false,
        playlistCount: null,
    };
}

export async function runYtDlpProbe(
    url: string,
    options: {
        signal?: AbortSignal;
        timeoutMs?: number;
        maxOutputBytes?: number;
        spawnProcess?: typeof spawn;
        assertUrl?: (url: string) => Promise<void>;
    } = {},
): Promise<YtDlpProbeResult> {
    await (options.assertUrl || assertPublicHttpUrl)(url);
    const timeoutMs = Math.max(1_000, options.timeoutMs ?? 20_000);
    const maxOutputBytes = Math.max(32, options.maxOutputBytes ?? 512 * 1_024);
    const spawnProcess = options.spawnProcess || spawn;
    const binLower = YTDLP_BIN.toLowerCase();
    const shell = os.platform() === 'win32' && (binLower.endsWith('.cmd') || binLower.endsWith('.bat'));
    const child = spawnProcess(YTDLP_BIN, buildYtDlpProbeArgs(url), { windowsHide: true, shell }) as ChildProcessWithoutNullStreams;
    return new Promise<YtDlpProbeResult>((resolve, reject) => {
        let stdout = Buffer.alloc(0);
        let stderr = '';
        let settled = false;
        let aborted = false;
        const abortError = () => Object.assign(new Error('yt-dlp probe cancelled'), { name: 'AbortError' });
        const finish = (error?: Error, value?: YtDlpProbeResult) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            options.signal?.removeEventListener('abort', abortChild);
            error ? reject(error) : resolve(value!);
        };
        const kill = (error: Error) => {
            if (settled) return;
            aborted = error.name === 'AbortError';
            finish(error);
            child.kill('SIGTERM');
        };
        const abortChild = () => kill(abortError());
        const timeout = setTimeout(() => kill(new Error(`yt-dlp 探测超时（${timeoutMs}ms）`)), timeoutMs);
        child.stdout.on('data', chunk => {
            const bytes = Buffer.from(chunk);
            if (stdout.length + bytes.length > maxOutputBytes) return kill(new Error('yt-dlp 探测输出超过限制'));
            stdout = Buffer.concat([stdout, bytes]);
        });
        child.stderr.on('data', chunk => {
            stderr += String(chunk);
            if (stderr.length > 8_000) stderr = stderr.slice(-8_000);
        });
        child.once('error', error => finish(aborted ? abortError() : error));
        child.once('close', code => {
            if (settled) return;
            if (options.signal?.aborted || aborted) return finish(abortError());
            if (code !== 0) return finish(new Error(stderr.trim() || `yt-dlp probe exited with code ${code}`));
            try { finish(undefined, parseYtDlpProbeOutput(stdout.toString('utf8'))); }
            catch (error) { finish(error as Error); }
        });
        if (options.signal?.aborted) abortChild();
        else options.signal?.addEventListener('abort', abortChild, { once: true });
    });
}
