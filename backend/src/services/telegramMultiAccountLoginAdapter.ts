import type { TelegramAuthorizedAccountAdapter } from './telegramMultiAccountLogin.js';

export interface TelegramLoginAccountRepository {
    upsertAccount(input: {
        telegramUserId: string;
        username?: string | null;
        displayName?: string | null;
        session: string;
        enabled?: boolean;
    }): Promise<unknown>;
}

export interface TelegramLoginAccountPool {
    refresh(): Promise<void>;
}

export interface TelegramLoginAccountAccessSweep {
    trigger(input: { accountIds: string[]; reason: 'account_created' }): Promise<unknown>;
}

/**
 * Production seam between ephemeral authentication and persistent account
 * runtime state. The repository owns encryption and userId upsert semantics;
 * the pool is reloaded only after the database write succeeds.
 */
export function createTelegramMultiAccountAuthorizedAdapter(deps: {
    repository: TelegramLoginAccountRepository;
    pool: TelegramLoginAccountPool;
    accessSweep?: TelegramLoginAccountAccessSweep;
}): TelegramAuthorizedAccountAdapter {
    return {
        async upsertByTelegramUserId({ session, account }): Promise<void> {
            const persisted = await deps.repository.upsertAccount({
                telegramUserId: account.userId,
                username: account.username,
                displayName: account.displayName,
                session,
                enabled: true,
            });
            await deps.pool.refresh();
            const accountId = String((persisted as { id?: unknown } | null)?.id || '');
            if (accountId && deps.accessSweep) {
                await deps.accessSweep.trigger({ accountIds: [accountId], reason: 'account_created' });
            }
        },
    };
}
