export type ApiActionErrorKind = 'unauthorized' | 'rate_limited' | 'source_deleted' | 'unavailable' | 'generic';
interface ApiErrorPayload { error?: unknown; message?: unknown; code?: unknown }

const appendRequestId = (message: string, requestId?: string) => requestId ? `${message}（请求 ID：${requestId}）` : message;
const parseRetryAfter = (value: string | null, now: number): number | undefined => {
    if (!value) return undefined;
    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
    const retryAt = Date.parse(value);
    return Number.isFinite(retryAt) ? Math.max(0, Math.ceil((retryAt - now) / 1000)) : undefined;
};
export const formatRetryAfter = (seconds?: number): string | null => {
    if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return null;
    const rounded = Math.ceil(seconds);
    const minutes = Math.floor(rounded / 60), rest = rounded % 60;
    return minutes && rest ? `${minutes} 分 ${rest} 秒` : minutes ? `${minutes} 分钟` : `${rest} 秒`;
};

export class ApiActionError extends Error {
    readonly kind: ApiActionErrorKind;
    readonly status: number;
    readonly code?: string;
    readonly requestId?: string;
    readonly retryAfterSeconds?: number;
    constructor(options: { kind: ApiActionErrorKind; status: number; message: string; code?: string; requestId?: string; retryAfterSeconds?: number }) {
        super(options.message); this.name = 'ApiActionError'; Object.assign(this, options);
        this.kind = options.kind; this.status = options.status;
    }
}

export async function apiActionErrorFromResponse(response: Response, fallback: string, now = Date.now()): Promise<ApiActionError> {
    const payload = await response.json().catch(() => ({})) as ApiErrorPayload;
    const code = typeof payload.code === 'string' ? payload.code : undefined;
    const requestId = response.headers.get('X-Request-Id') || undefined;
    if (response.status === 401 || response.status === 428) return new ApiActionError({ kind: 'unauthorized', status: response.status, message: '登录会话已失效，请重新登录', code, requestId });
    if (response.status === 429) {
        const retryAfterSeconds = parseRetryAfter(response.headers.get('Retry-After'), now);
        const retry = formatRetryAfter(retryAfterSeconds);
        return new ApiActionError({ kind: 'rate_limited', status: 429, retryAfterSeconds, code, requestId, message: appendRequestId(retry ? `请求过于频繁，请在 ${retry}后重试` : '请求过于频繁，请稍后重试', requestId) });
    }
    if (response.status === 410 || code === 'MEDIA_SOURCE_MISSING') return new ApiActionError({ kind: 'source_deleted', status: response.status, code, requestId, message: appendRequestId('源文件已删除或已移入回收站，无法继续操作', requestId) });
    if (response.status === 503) return new ApiActionError({ kind: 'unavailable', status: 503, code, requestId, message: appendRequestId('服务暂时不可用，请稍后重试', requestId) });
    const serverMessage = typeof payload.error === 'string' ? payload.error : typeof payload.message === 'string' ? payload.message : fallback;
    return new ApiActionError({ kind: 'generic', status: response.status, code, requestId, message: appendRequestId(serverMessage || fallback, requestId) });
}

export function describeActionFailure(action: string, error: unknown): string {
    if (error instanceof ApiActionError) return error.kind === 'unauthorized' ? `登录会话已失效，已为你退出，请重新登录后${action}` : `${action}失败：${error.message}`;
    if (error instanceof DOMException && ['NotAllowedError', 'SecurityError'].includes(error.name)) return `${action}失败，请检查浏览器剪贴板权限后重试，也可手动选择内容复制`;
    return error instanceof Error && error.message ? `${action}失败：${error.message}` : `${action}失败，请稍后重试`;
}
