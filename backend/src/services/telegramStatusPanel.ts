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

function formatBytesCompact(value: number): string {
    if (!Number.isFinite(value) || value <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
    const amount = value / (1024 ** index);
    return `${amount >= 10 || index === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[index]}`;
}

const STATUS_LABELS: Record<string, string> = {
    ready: '正常', running: '运行中', connected: '已连接', disabled: '未启用', expired: '登录已过期',
    failed: '异常', error: '异常', unknown: '未知', available: '正常', healthy: '正常', cooldown: '冷却中',
};

function statusLabel(value: string | null | undefined): string {
    return STATUS_LABELS[String(value || 'unknown').toLowerCase()] || sanitizeTelegramStatusText(value || '未知');
}

export function buildTelegramStatusPanel(input: TelegramStatusPanelInput): string {
    const used = Math.max(0, input.disk.totalBytes - input.disk.freeBytes);
    return [
        '🩺 **TG Vault 诊断状态**',
        `操作 ID：${sanitizeTelegramStatusText(input.requestId)}`,
        '',
        `Bot：${statusLabel(input.bot.status)}${input.bot.degraded ? '（降级）' : ''} · 重连 ${input.bot.reconnectCount || 0} 次`,
        `账号下载器：${statusLabel(input.userClient.status)}${input.userClient.username ? ` · @${sanitizeTelegramStatusText(input.userClient.username)}` : ''}`,
        input.userClient.action ? `账号恢复：${sanitizeTelegramStatusText(input.userClient.action)}` : null,
        '',
        `当前存储：${input.target.provider} · ${sanitizeTelegramStatusText(input.target.accountName)}`,
        `连接检查：${statusLabel(input.target.probeStatus)}`,
        input.target.cooldownUntil ? `恢复时间：${sanitizeTelegramStatusText(input.target.cooldownUntil)}` : null,
        input.target.probeError ? `存储错误：${sanitizeTelegramStatusText(input.target.probeError)}` : null,
        '',
        `临时磁盘：可用 ${formatBytesCompact(input.disk.freeBytes)} / ${formatBytesCompact(input.disk.totalBytes)} · 已用 ${percent(used, input.disk.totalBytes)}%`,
        `队列：活跃 ${input.queue.active} · 等待 ${input.queue.pending} · 失败 ${input.queue.failed}${input.queue.paused ? ' · 已暂停' : ''}`,
        `订阅：启用 ${input.subscriptions.enabled} · 最近扫描 ${sanitizeTelegramStatusText(input.subscriptions.lastScanAt || '无')}`,
        input.subscriptions.lastError ? `订阅错误：${sanitizeTelegramStatusText(input.subscriptions.lastError)}` : null,
        `对账：待对账：${input.reconciliation.pending} · 需人工：${input.reconciliation.operatorRequired}`,
        '',
        input.bot.action ? `建议：${sanitizeTelegramStatusText(input.bot.action)}` : '建议：如组件异常，请携带操作 ID 查看结构化日志。',
    ].filter(Boolean).join('\n');
}
