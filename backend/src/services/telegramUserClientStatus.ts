export type TelegramUserClientState = 'not_configured' | 'missing_session' | 'disabled' | 'ready' | 'expired' | 'permission_denied' | 'error';

export interface TelegramUserClientStatus {
    status: TelegramUserClientState;
    userId: string | null;
    username: string | null;
    checkedAt: string | null;
    lastError: string | null;
    action: string | null;
}

let current: TelegramUserClientStatus = {
    status: 'not_configured', userId: null, username: null, checkedAt: null, lastError: null, action: '配置 Telegram API 后在网页登录账号',
};

export function getTelegramUserClientStatus(): TelegramUserClientStatus {
    return { ...current };
}

export function recordTelegramUserClientReady(input: { userId: string; username?: string | null; checkedAt?: string }): void {
    current = {
        status: 'ready', userId: input.userId, username: input.username || null,
        checkedAt: input.checkedAt || new Date().toISOString(), lastError: null, action: null,
    };
}

export function recordTelegramUserClientFailure(status: Exclude<TelegramUserClientState, 'ready'>, message: string): void {
    const actions: Record<Exclude<TelegramUserClientState, 'ready'>, string> = {
        not_configured: '配置 Telegram API 后在网页登录账号',
        missing_session: '在网页中登录 Telegram 用户账号',
        disabled: '可随时重新启用，已加密保存的登录信息会保留',
        expired: '在网页中重新登录 Telegram 用户账号',
        permission_denied: '先用该账号加入目标频道并重新测试',
        error: '检查网络与后端日志后重新测试',
    };
    current = { ...current, status, checkedAt: new Date().toISOString(), lastError: message, action: actions[status] };
}
