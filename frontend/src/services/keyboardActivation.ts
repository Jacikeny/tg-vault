export interface KeyboardActivationEventLike<T = unknown> {
    key: string;
    target: T;
    currentTarget: T;
    preventDefault(): void;
}

export function activateParentControl<T>(event: KeyboardActivationEventLike<T>, action: () => void): boolean {
    if (event.target !== event.currentTarget) return false;
    if (event.key !== 'Enter' && event.key !== ' ') return false;
    event.preventDefault();
    action();
    return true;
}
