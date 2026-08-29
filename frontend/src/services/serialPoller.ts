export interface SerialPollerOptions {
    run: () => Promise<void>;
    schedule: (callback: () => void, delayMs: number) => unknown;
    cancel: (handle: unknown) => void;
    delayMs: number;
    nextDelayMs?: () => number;
}

export function createSerialPoller(options: SerialPollerOptions) {
    let stopped = false;
    let timer: unknown = null;
    let running = false;

    const tick = async () => {
        if (stopped || running) return;
        running = true;
        try {
            await options.run();
        } finally {
            running = false;
            if (!stopped) timer = options.schedule(() => void tick(), options.nextDelayMs?.() ?? options.delayMs);
        }
    };

    return {
        start() { void tick(); },
        stop() {
            stopped = true;
            if (timer !== null) options.cancel(timer);
        },
    };
}
