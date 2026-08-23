import { LatestRequest, type RequestGeneration } from './latestRequest.js';

export interface FileQueryControllerOptions<T> {
    debounceMs?: number;
    initialValue?: T;
}

export class FileQueryController<T = unknown> {
    private readonly latest = new LatestRequest();
    private readonly debounceMs: number;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private pending: Promise<T | undefined> = Promise.resolve(undefined);
    currentValue: T | undefined;

    constructor(options: FileQueryControllerOptions<T> = {}) {
        this.debounceMs = Math.max(0, options.debounceMs ?? 250);
        this.currentValue = options.initialValue;
    }

    private async run(loader: (signal: AbortSignal, request: RequestGeneration) => Promise<T>): Promise<T | undefined> {
        const request = this.latest.begin();
        try {
            const value = await loader(request.signal, request);
            if (!request.isCurrent()) return undefined;
            this.currentValue = value;
            return value;
        } catch (error) {
            if ((error as { name?: string })?.name === 'AbortError') return undefined;
            throw error;
        }
    }

    schedule(_key: string, loader: (signal: AbortSignal, request: RequestGeneration) => Promise<T>): Promise<T | undefined> {
        if (this.timer) clearTimeout(this.timer);
        this.pending = new Promise<T | undefined>((resolve, reject) => {
            this.timer = setTimeout(() => {
                this.timer = null;
                this.run(loader).then(resolve, reject);
            }, this.debounceMs);
        });
        return this.pending;
    }

    refresh(loader: (signal: AbortSignal, request: RequestGeneration) => Promise<T>): Promise<T | undefined> {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        this.pending = this.run(loader);
        return this.pending;
    }

    cancel(): void {
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
        this.latest.cancel();
    }
}
