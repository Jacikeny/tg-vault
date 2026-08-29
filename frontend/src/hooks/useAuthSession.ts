import { useCallback, useEffect, useState } from 'react';
import { authService } from '../services/auth';

export interface AuthSessionState {
    isAuthenticated: boolean;
    needsPassword: boolean;
    setupRequired: boolean;
    telegramPinRequired: boolean;
    authChecking: boolean;
}

export function useAuthSession(onInvalidated: () => void) {
    const [state, setState] = useState<AuthSessionState>({
        isAuthenticated: false,
        needsPassword: true,
        setupRequired: false,
        telegramPinRequired: false,
        authChecking: true,
    });

    useEffect(() => authService.onSessionInvalidated(() => {
        setState(previous => ({ ...previous, isAuthenticated: false }));
        onInvalidated();
    }), [onInvalidated]);

    useEffect(() => {
        let active = true;
        const check = async () => {
            try {
                const status = await authService.getAuthStatus();
                if (!active) return;
                const authenticated = status.setupRequired
                    ? false
                    : !status.passwordRequired
                        ? true
                        : await authService.verify();
                if (!active) return;
                setState({
                    isAuthenticated: authenticated,
                    needsPassword: status.passwordRequired,
                    setupRequired: status.setupRequired,
                    telegramPinRequired: status.telegramPinRequired,
                    authChecking: false,
                });
            } catch (error) {
                console.error('检查认证状态失败:', error);
                if (active) setState(previous => ({ ...previous, authChecking: false }));
            }
        };
        void check();
        return () => { active = false; };
    }, []);

    const login = useCallback(async (password: string) => {
        const result = await authService.login(password);
        if (result.success && !result.requiresTOTP) setState(previous => ({ ...previous, isAuthenticated: true }));
        return result;
    }, []);

    const setup = useCallback(async (webPassword: string, telegramPin?: string) => {
        const result = await authService.setup(webPassword, telegramPin);
        if (result.success) {
            setState(previous => ({ ...previous, setupRequired: false, needsPassword: true, isAuthenticated: true }));
        }
        return result;
    }, []);

    const signOut = useCallback(async () => {
        await authService.logout();
        setState(previous => ({ ...previous, isAuthenticated: false }));
    }, []);

    const markUnauthenticated = useCallback(() => {
        setState(previous => ({ ...previous, isAuthenticated: false }));
    }, []);

    return { ...state, login, setup, signOut, markUnauthenticated };
}
