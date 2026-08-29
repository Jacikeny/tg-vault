export interface SubscriptionPresentationRow {
    enabled: boolean;
    source: string;
    source_original?: string | null;
    title?: string | null;
    target_mode?: 'fixed' | string;
    target_account_name?: string | null;
    target_provider?: string | null;
    last_message_id?: number | null;
    folder_override?: string | null;
    last_scan_at?: string | Date | null;
    next_scan_at?: string | Date | null;
    last_result?: { status?: string; found?: number; failed?: number } | null;
    last_error?: string | null;
    disabled_reason?: string | null;
}

export function buildSubscriptionDisplayLines(row: SubscriptionPresentationRow, index: number): string {
    const status = row.enabled ? '✅' : '⏸️';
    const source = row.source_original && row.source_original !== row.source
        ? `${row.source_original} → ${row.source}`
        : row.source;
    const target = row.target_mode === 'fixed'
        ? `${row.target_account_name || row.target_provider || '指定存储'}`
        : '跟随系统默认';
    const resultStatus: Record<string, string> = {
        success: '成功', completed: '完成', failed: '失败', partial: '部分完成', running: '进行中', paused: '已暂停',
    };
    return [
        `${index + 1}. ${status} ${row.title || row.source_original || row.source}`,
        `   来源：${source}`,
        `   同步位置：第 ${row.last_message_id || 0} 条消息之后`,
        row.folder_override ? `   📁 目录：${row.folder_override}` : '   📁 目录：默认自动分类',
        `   🎯 存储：${target}`,
        row.last_scan_at ? `   🔎 上次扫描：${new Date(row.last_scan_at).toLocaleString('zh-CN', { hour12: false })}` : '   🔎 尚未扫描',
        row.next_scan_at ? `   ⏭️ 下次扫描约：${new Date(row.next_scan_at).toLocaleString('zh-CN', { hour12: false })}` : null,
        row.last_result ? `   📊 最近结果：${resultStatus[row.last_result.status || ''] || '已记录'}${row.last_result.found !== undefined ? `，发现 ${row.last_result.found}` : ''}${row.last_result.failed ? `，失败 ${row.last_result.failed}` : ''}` : null,
        row.last_error ? `   ⚠️ ${row.last_error}` : null,
        !row.enabled && row.disabled_reason ? `   ⚠️ ${row.disabled_reason}` : null,
    ].filter(Boolean).join('\n');
}

export function buildSubscriptionManagePanel(rows: SubscriptionPresentationRow[], page: { page: number; totalPages: number; startIndex: number; visibleRows: SubscriptionPresentationRow[] }): string {
    return [
        '📡 **频道订阅**',
        ...(page.totalPages > 1 ? [`第 ${page.page + 1}/${page.totalPages} 页 · 共 ${rows.length} 个`] : []),
        '',
        page.visibleRows.length > 0
            ? page.visibleRows.map((row, index) => buildSubscriptionDisplayLines(row, page.startIndex + index)).join('\n\n')
            : '当前没有订阅。',
        '',
        '👇 点击下方按钮管理或新增订阅。',
    ].join('\n');
}
