export interface YtDlpPlaylistSelectionInput {
    enabled: boolean;
    start: number;
    end: number;
    maxItems: number;
}
export interface YtDlpPlaylistBudget {
    hardMaxItems?: number;
    maxBudgetBytes?: number;
    estimatedItemBytes?: number;
}
export interface YtDlpPlaylistSelection extends YtDlpPlaylistSelectionInput { count: number }

export function validateYtDlpPlaylistSelection(input: YtDlpPlaylistSelectionInput, budget: YtDlpPlaylistBudget = {}): YtDlpPlaylistSelection {
    if (!input.enabled) throw new Error('播放列表必须显式启用');
    for (const [name, value] of Object.entries({ start: input.start, end: input.end, maxItems: input.maxItems })) {
        if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} 必须是正整数`);
    }
    if (input.end < input.start) throw new Error('播放列表范围无效');
    const count = input.end - input.start + 1;
    const configuredMax = Number.parseInt(process.env.YTDLP_PLAYLIST_MAX_ITEMS || '25', 10) || 25;
    const hardMaxItems = Math.max(1, budget.hardMaxItems ?? configuredMax);
    if (count > input.maxItems || input.maxItems > hardMaxItems) throw new Error(`播放列表超过最大条目上限 ${hardMaxItems}`);
    const estimatedBytes = count * Math.max(0, budget.estimatedItemBytes ?? 0);
    if (budget.maxBudgetBytes !== undefined && estimatedBytes > budget.maxBudgetBytes) throw new Error('播放列表预计大小超过下载预算');
    return { ...input, count };
}

export function buildYtDlpPlaylistArgs(url: string, input: YtDlpPlaylistSelectionInput): string[] {
    const selection = validateYtDlpPlaylistSelection(input);
    return ['--yes-playlist', '--playlist-start', String(selection.start), '--playlist-end', String(selection.end), '--max-downloads', String(selection.maxItems), '--', url];
}
