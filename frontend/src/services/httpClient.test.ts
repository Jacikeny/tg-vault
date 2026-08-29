import assert from 'node:assert/strict';
import test from 'node:test';

const installBrowserGlobals = () => {
    const listeners = new Map<string, Set<(event: Event) => void>>();
    const storage = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: {
            getItem: (key: string) => storage.get(key) ?? null,
            setItem: (key: string, value: string) => storage.set(key, value),
            removeItem: (key: string) => storage.delete(key),
        },
    });
    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: {
            addEventListener: (type: string, listener: (event: Event) => void) => {
                const set = listeners.get(type) ?? new Set();
                set.add(listener);
                listeners.set(type, set);
            },
            removeEventListener: (type: string, listener: (event: Event) => void) => listeners.get(type)?.delete(listener),
            dispatchEvent: (event: Event) => {
                listeners.get(event.type)?.forEach(listener => listener(event));
                return true;
            },
        },
    });
};

test('http client includes credentials, merges headers, and invalidates auth for 401', async () => {
    installBrowserGlobals();
    const [{ apiRequest }, { authService }] = await Promise.all([import('./httpClient.js'), import('./auth.js')]);
    let request: { input: RequestInfo | URL; init?: RequestInit } | undefined;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        request = { input, init };
        return new Response(JSON.stringify({ error: 'expired' }), { status: 401, headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'req-auth' } });
    }) as typeof fetch;
    let invalidated = 0;
    const unsubscribe = authService.onSessionInvalidated(detail => { invalidated = detail.status; });
    await assert.rejects(() => apiRequest('/api/files', { headers: { 'X-Test': 'yes' } }), (error: any) => error.kind === 'unauthorized' && error.requestId === 'req-auth');
    unsubscribe();
    assert.equal(request?.init?.credentials, 'include');
    assert.equal(new Headers(request?.init?.headers).get('X-Test'), 'yes');
    assert.equal(invalidated, 401);
});

test('http client preserves AbortError and supports protocol statuses', async () => {
    installBrowserGlobals();
    const { apiRequest } = await import('./httpClient.js');
    globalThis.fetch = (async () => new Response(JSON.stringify({ status: 'busy' }), { status: 409 })) as typeof fetch;
    const response = await apiRequest('/api/chunked/id', { acceptedStatuses: [409] });
    assert.equal(response.status, 409);

    globalThis.fetch = (async () => { throw new DOMException('cancelled', 'AbortError'); }) as typeof fetch;
    await assert.rejects(() => apiRequest('/api/files'), (error: any) => error?.name === 'AbortError');
});

test('http client preserves browser opaque manual redirects for original links', async () => {
    installBrowserGlobals();
    const { apiRequest } = await import('./httpClient.js');
    globalThis.fetch = (async () => ({ ok: false, status: 0, type: 'opaqueredirect', headers: new Headers() }) as Response) as typeof fetch;
    const response = await apiRequest('/api/files/id/original', { redirect: 'manual' });
    assert.equal(response.type, 'opaqueredirect');
});
