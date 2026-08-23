export function buildSubscriptionDisplayLines(row: any, index: number): string {
    const status = row.enabled ? '✅' : '⏸️';
    const sourceLine = row.source_original && row.source_original !== row.source
        ? `   ${row.source_original} → ${row.source} · last_id=${row.last_message_id || 0}`
        : `   ${row.source} · last_id=${row.last_message_id || 0}`;
    return [
        `${index + 1}. ${status} ${row.title || row.source_original || row.source}`,
        sourceLine,
        row.folder_override ? `   📁 专属目录：${row.folder_override}` : '   📁 保存策略：默认自动分类',
        `   🎯 Target：${row.target_mode === 'fixed' ? `${row.target_provider} / ${row.target_account_id || 'local'}（固定）` : '跟随系统默认（每次 admission 快照）'}`,
        row.last_scan_at ? `   🔎 上次扫描：${new Date(row.last_scan_at).toLocaleString('zh-CN', { hour12: false })}` : '   🔎 尚未扫描',
        row.last_success_at ? `   ✅ 上次成功：${new Date(row.last_success_at).toLocaleString('zh-CN', { hour12: false })}` : null,
        row.next_scan_at ? `   ⏭️ 下次扫描约：${new Date(row.next_scan_at).toLocaleString('zh-CN', { hour12: false })}` : null,
        row.last_result ? `   📊 最近结果：${row.last_result.status || 'unknown'}${row.last_result.found !== undefined ? `，发现 ${row.last_result.found}` : ''}${row.last_result.failed ? `，失败 ${row.last_result.failed}` : ''}` : null,
        row.last_error ? `   ⚠️ 最近错误：${row.last_error}` : null,
        !row.enabled && row.disabled_reason ? `   ⚠️ ${row.disabled_reason}` : null,
        !row.enabled && row.disabled_at ? `   暂停时间：${new Date(row.disabled_at).toLocaleString('zh-CN', { hour12: false })}` : null,
    ].filter(Boolean).join('\n');
}

export function buildSubscriptionManagePanel(rows: any[], page: { page: number; totalPages: number; startIndex: number; visibleRows: any[] }): string {
    return [
        '📡 **频道订阅管理**',
        ...(page.totalPages > 1 ? [`第 ${page.page + 1}/${page.totalPages} 页 · 共 ${rows.length} 个订阅`] : []),
        '',
        page.visibleRows.length > 0
            ? page.visibleRows.map((row, index) => buildSubscriptionDisplayLines(row, page.startIndex + index)).join('\n')
            : '当前没有订阅。',
        '',
        rows.length > 0 ? '可使用操作按钮同步、暂停、修改目标、补抓或重试；已保存文件不会随取消订阅删除。' : '回复频道用户名或链接可新增订阅。',
        '回复频道用户名或链接也可新增订阅。',
        '例如：`@channel_username`、`https://t.me/channel_username` 或已加入的 `https://t.me/+hash` 私密链接',
        '',
        '新增订阅时可指定独立目录，不会改变全局 /path_rules。',
        '发送“取消”可退出。',
    ].join('\n');
}
