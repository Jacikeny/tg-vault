import type {
    TelegramNotificationPreferences,
    TelegramSuccessNotificationMode,
} from './telegramNotificationPreferences.js';

export interface NotificationSettingsButton {
    text: string;
    data: string;
}

const modeLabels: Record<TelegramSuccessNotificationMode, string> = {
    immediate: '立即通知',
    digest: '合并摘要',
    off: '不通知',
};

function selected(active: boolean, label: string): string {
    return `${active ? '✅' : '▫️'} ${label}`;
}

export function buildNotificationSettingsButtonRows(
    preferences: TelegramNotificationPreferences,
): NotificationSettingsButton[][] {
    const quietEnabled = Boolean(preferences.quietStart && preferences.quietEnd);
    return [
        [
            { text: selected(preferences.successMode === 'immediate', '成功·立即'), data: 'nt_success_immediate' },
            { text: selected(preferences.successMode === 'digest', '成功·摘要'), data: 'nt_success_digest' },
            { text: selected(preferences.successMode === 'off', '成功·关闭'), data: 'nt_success_off' },
        ],
        [
            { text: selected(preferences.failureImmediate, '失败·立即'), data: 'nt_failure_immediate' },
            { text: selected(!preferences.failureImmediate, '失败·摘要'), data: 'nt_failure_digest' },
        ],
        [
            { text: selected(!preferences.subscriptionDigest, '订阅·立即'), data: 'nt_subscription_immediate' },
            { text: selected(preferences.subscriptionDigest, '订阅·摘要'), data: 'nt_subscription_digest' },
        ],
        [
            { text: selected(quietEnabled && preferences.quietStart === '22:00' && preferences.quietEnd === '07:00', '安静 22:00–07:00'), data: 'nt_quiet_22_07' },
            { text: selected(!quietEnabled, '关闭安静时段'), data: 'nt_quiet_off' },
        ],
        [
            { text: selected(preferences.timezone === 'Asia/Shanghai', '时区·上海'), data: 'nt_timezone_asia_shanghai' },
            { text: selected(preferences.timezone === 'UTC', '时区·UTC'), data: 'nt_timezone_utc' },
        ],
    ];
}

export function buildNotificationSettingsText(preferences: TelegramNotificationPreferences): string {
    const quiet = preferences.quietStart && preferences.quietEnd
        ? `${preferences.quietStart}–${preferences.quietEnd}`
        : '未开启';

    return [
        '🔔 **通知设置**',
        '',
        `失败：${preferences.failureImmediate ? '立即' : '摘要'} ｜ 成功：${modeLabels[preferences.successMode]}`,
        `订阅：${preferences.subscriptionDigest ? '摘要' : '立即'} ｜ 安静：${quiet}`,
        `时区：${preferences.timezone}`,
        '安全告警始终立即通知。',
        '',
        '👇 点击按钮修改',
    ].join('\n');
}

export function updateNotificationPreference(
    current: TelegramNotificationPreferences,
    args: string[],
): Record<string, unknown> {
    const [rawKey = '', rawValue = ''] = args;
    const key = rawKey.toLowerCase();
    const value = rawValue.trim();
    const update: Record<string, unknown> = { ...current };

    if (key === 'timezone') {
        if (!value) throw new Error('请提供时区，例如 Asia/Shanghai');
        update.timezone = value;
    } else if (key === 'quiet') {
        if (['off', 'none', 'disable'].includes(value.toLowerCase())) {
            update.quietStart = null;
            update.quietEnd = null;
            return update;
        }
        const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/);
        if (!match) throw new Error('安静时段格式应为 HH:MM-HH:MM，例如 22:00-07:00；关闭请使用 quiet off');
        update.quietStart = `${match[1]}:${match[2]}`;
        update.quietEnd = `${match[3]}:${match[4]}`;
    } else if (key === 'success') {
        if (!['immediate', 'digest', 'off'].includes(value)) {
            throw new Error('成功通知可选值：immediate（立即）、digest（摘要）、off（关闭）');
        }
        update.successMode = value;
    } else if (key === 'failure') {
        if (!['immediate', 'digest'].includes(value)) {
            throw new Error('失败通知可选值：immediate（立即）或 digest（摘要）');
        }
        update.failureImmediate = value === 'immediate';
    } else if (key === 'subscription') {
        if (!['immediate', 'digest'].includes(value)) {
            throw new Error('订阅通知可选值：immediate（立即）或 digest（摘要）');
        }
        update.subscriptionDigest = value === 'digest';
    } else {
        throw new Error('未知设置。请直接发送 /notifications 查看可用选项');
    }
    return update;
}

export function notificationCallbackArgs(data: string): string[] | null {
    const fixed: Record<string, string[]> = {
        nt_failure_immediate: ['failure', 'immediate'],
        nt_failure_digest: ['failure', 'digest'],
        nt_subscription_immediate: ['subscription', 'immediate'],
        nt_subscription_digest: ['subscription', 'digest'],
        nt_quiet_22_07: ['quiet', '22:00-07:00'],
        nt_quiet_off: ['quiet', 'off'],
        nt_timezone_asia_shanghai: ['timezone', 'Asia/Shanghai'],
        nt_timezone_utc: ['timezone', 'UTC'],
    };
    if (fixed[data]) return fixed[data];
    const success = data.match(/^nt_success_(immediate|digest|off)$/);
    return success ? ['success', success[1]] : null;
}
