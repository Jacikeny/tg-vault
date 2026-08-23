export interface TelegramStatusPanelInput {
    requestId: string;
    bot: { status: string; degraded?: boolean; reconnectCount?: number; lastError?: string | null; action?: string | null };
    userClient: { status: string; username?: string | null; action?: string | null; lastError?: string | null };
    target: { provider: string; accountName: string; probeStatus?: string | null; cooldownUntil?: string | null; probeError?: string | null };
    disk: { freeBytes: number; totalBytes: number };
    queue: { active: number; pending: number; failed: number; paused: boolean };
    subscriptions: { enabled: number; lastScanAt?: string | null; lastError?: string | null };
    reconciliation: { pending: number; operatorRequired: number };
}

export function sanitizeTelegramStatusText(value: unknown): string {
    if (!value) return '无';
    const text = String(value);
    if (/(?:^|\s)(?:\/[^\s]+|[A-Za-z]:\\[^\s]+)/.test(text)
        || /(?:bearer|token|secret|password|api[_-]?key|access[_-]?key|refresh[_-]?token)[=: ]/i.test(text)
        || /AKIA[0-9A-Z-]+/i.test(text)) return '[已脱敏]';
    return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}

function percent(used: number, total: number): number {
    return total > 0 ? Math.max(0, Math.min(100, Math.round((used / total) * 100))) : 0;
}

export function buildTelegramStatusPanel(input: TelegramStatusPanelInput): string {
    const used = Math.max(0, input.disk.totalBytes - input.disk.freeBytes);
    return [
        '🩺 **TG Vault 诊断状态**',
        `操作 ID：${sanitizeTelegramStatusText(input.requestId)}`,
        '',
        `Bot：${input.bot.status}${input.bot.degraded ? '（降级）' : ''} · 重连 ${input.bot.reconnectCount || 0}`,
        `账号下载器：${input.userClient.status}${input.userClient.username ? ` / @${sanitizeTelegramStatusText(input.userClient.username)}` : ''}`,
        input.userClient.action ? `账号恢复：${sanitizeTelegramStatusText(input.userClient.action)}` : null,
        '',
        `Target：${input.target.provider} / ${sanitizeTelegramStatusText(input.target.accountName)}`,
        `Probe：${input.target.probeStatus || 'unknown'}`,
        input.target.cooldownUntil ? `Cooldown：${sanitizeTelegramStatusText(input.target.cooldownUntil)}` : 'Cooldown：无',
        input.target.probeError ? `Probe 错误：${sanitizeTelegramStatusText(input.target.probeError)}` : null,
        '',
        `临时磁盘：${input.disk.freeBytes}/${input.disk.totalBytes} bytes 可用 · 已用 ${percent(used, input.disk.totalBytes)}%`,
        `队列：活跃 ${input.queue.active} · 等待 ${input.queue.pending} · 失败 ${input.queue.failed}${input.queue.paused ? ' · 已暂停' : ''}`,
        `订阅：启用 ${input.subscriptions.enabled} · 最近扫描 ${sanitizeTelegramStatusText(input.subscriptions.lastScanAt || '无')}`,
        input.subscriptions.lastError ? `订阅错误：${sanitizeTelegramStatusText(input.subscriptions.lastError)}` : null,
        `对账：待对账：${input.reconciliation.pending} · 需人工：${input.reconciliation.operatorRequired}`,
        '',
        input.bot.action ? `建议：${sanitizeTelegramStatusText(input.bot.action)}` : '建议：如组件异常，请携带操作 ID 查看结构化日志。',
    ].filter(Boolean).join('\n');
}
