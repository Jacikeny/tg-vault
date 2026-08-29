export function errorMessage(error: unknown, fallback = '操作失败'): string {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === 'string' && error) return error;
    return fallback;
}

export function errorCode(error: unknown): string | undefined {
    if (!error || typeof error !== 'object' || !('code' in error)) return undefined;
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
}

export function isErrorNamed(error: unknown, name: string): boolean {
    return error instanceof Error && error.name === name;
}
