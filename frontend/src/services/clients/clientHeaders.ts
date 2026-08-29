import { authService } from '../auth';

export function getApiHeaders(additionalHeaders: Record<string, string> = {}): HeadersInit {
    return {
        ...authService.getAuthHeaders(),
        ...additionalHeaders,
    };
}
