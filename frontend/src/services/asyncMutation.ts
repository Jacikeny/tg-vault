export interface AsyncMutationHooks<T> {
    action: () => Promise<T>;
    onSuccess: (result: T) => void;
    onFailure: (error: unknown) => void;
    onSettled: () => void;
}

export async function performAsyncMutation<T>(hooks: AsyncMutationHooks<T>): Promise<boolean> {
    try {
        const result = await hooks.action();
        hooks.onSuccess(result);
        return true;
    } catch (error) {
        hooks.onFailure(error);
        return false;
    } finally {
        hooks.onSettled();
    }
}
