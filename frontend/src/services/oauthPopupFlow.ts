export type OAuthPopupFlowState = 'waiting' | 'success' | 'cancelled' | 'failed';

interface OAuthPopupHost {
    addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
    removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
    setInterval(callback: () => void, intervalMs: number): number;
    clearInterval(timer: number): void;
}

interface OAuthPopupFlowOptions {
    host: OAuthPopupHost;
    popup: Pick<Window, 'closed'>;
    classifyMessage: (event: MessageEvent) => 'success' | 'failed' | null;
    onSuccess: (event: MessageEvent) => void | Promise<void>;
    onStateChange: (state: OAuthPopupFlowState, error?: unknown) => void | Promise<void>;
    intervalMs?: number;
}

export function monitorOAuthPopup(options: OAuthPopupFlowOptions): () => void {
    let terminal = false;
    let disposed = false;
    let timer = 0;

    const cleanup = () => {
        if (disposed) return;
        disposed = true;
        options.host.removeEventListener('message', handleMessage);
        options.host.clearInterval(timer);
    };
    const finish = async (state: OAuthPopupFlowState, event?: MessageEvent) => {
        if (terminal) return;
        terminal = true;
        cleanup();
        if (state === 'success' && event) {
            try {
                await options.onSuccess(event);
                await options.onStateChange('success');
            } catch (error) {
                await options.onStateChange('failed', error);
            }
            return;
        }
        await options.onStateChange(state, state === 'failed' ? event : undefined);
    };
    function handleMessage(event: MessageEvent) {
        const state = options.classifyMessage(event);
        if (state === 'success') void finish('success', event);
        else if (state === 'failed') void finish('failed', event);
    }

    options.host.addEventListener('message', handleMessage);
    timer = options.host.setInterval(() => {
        if (options.popup.closed) void finish('cancelled');
    }, options.intervalMs ?? 1_000);
    void options.onStateChange('waiting');
    return cleanup;
}
