import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { deleteSettings, getSettingStrict, setSetting, setSettings } from '../utils/settings.js';
import { getTelegramBotStatus, setTelegramBotRequired } from './telegramBotStatus.js';
import { isTelegramPinConfigured } from '../utils/authSettings.js';

export const TELEGRAM_BOT_TOKEN_SETTING = 'telegram_bot_token';
export const TELEGRAM_API_ID_SETTING = 'telegram_api_id';
export const TELEGRAM_API_HASH_SETTING = 'telegram_api_hash';
export const TELEGRAM_BOT_ENABLED_SETTING = 'telegram_bot_enabled';
export const TELEGRAM_REQUIRED_SETTING = 'telegram_required';

const CREDENTIAL_KEYS = [TELEGRAM_BOT_TOKEN_SETTING, TELEGRAM_API_ID_SETTING, TELEGRAM_API_HASH_SETTING];
const ALL_KEYS = [...CREDENTIAL_KEYS, TELEGRAM_BOT_ENABLED_SETTING, TELEGRAM_REQUIRED_SETTING];
const ENV_TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const ENV_TELEGRAM_API_ID = process.env.TELEGRAM_API_ID || '';
const ENV_TELEGRAM_API_HASH = process.env.TELEGRAM_API_HASH || '';

export interface TelegramBotCredentials {
    botToken: string;
    apiId: number;
    apiHash: string;
}

export interface TelegramBotPublicConfig {
    configured: boolean;
    enabled: boolean;
    required: boolean;
    pinConfigured: boolean;
    source: 'web' | 'environment' | 'none';
    status: ReturnType<typeof getTelegramBotStatus>['status'];
    bot: { username: string | null; displayName: string | null } | null;
    lastConnectedAt: string | null;
    lastError: string | null;
    action: string | null;
}

function enabledValue(value: string | null | undefined, fallback: boolean): boolean {
    if (value == null || value === '') return fallback;
    return /^(1|true|yes|on)$/i.test(value);
}

export function normalizeTelegramBotCredentials(input: any): TelegramBotCredentials {
    const botToken = String(input?.botToken || '').trim();
    const apiIdText = String(input?.apiId || '').trim();
    const apiHash = String(input?.apiHash || '').trim();
    if (!/^\d+$/.test(apiIdText) || Number(apiIdText) <= 0 || !Number.isSafeInteger(Number(apiIdText))) {
        throw new Error('API ID 必须是有效的正整数');
    }
    if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(botToken)) throw new Error('Bot Token 格式无效');
    if (!/^[a-fA-F0-9]{32}$/.test(apiHash)) throw new Error('API Hash 必须是 32 位十六进制字符串');
    return { botToken, apiId: Number(apiIdText), apiHash };
}

async function getWebCredentials(): Promise<TelegramBotCredentials | null> {
    const [botTokenRow, apiIdRow, apiHashRow] = await Promise.all([
        getSettingStrict<string>(TELEGRAM_BOT_TOKEN_SETTING),
        getSettingStrict<string>(TELEGRAM_API_ID_SETTING),
        getSettingStrict<string>(TELEGRAM_API_HASH_SETTING),
    ]);
    const foundCount = [botTokenRow, apiIdRow, apiHashRow].filter(row => row.found).length;
    if (foundCount === 0) return null;
    if (foundCount !== 3 || !botTokenRow.value || !apiIdRow.value || !apiHashRow.value) {
        throw new Error('Telegram Bot 网页凭证不完整，已拒绝回退到环境变量');
    }
    return normalizeTelegramBotCredentials({ botToken: botTokenRow.value, apiId: apiIdRow.value, apiHash: apiHashRow.value });
}

function getEnvironmentCredentials(): TelegramBotCredentials | null {
    const botToken = ENV_TELEGRAM_BOT_TOKEN;
    const apiId = ENV_TELEGRAM_API_ID;
    const apiHash = ENV_TELEGRAM_API_HASH;
    if (!botToken || !apiId || !apiHash) return null;
    try { return normalizeTelegramBotCredentials({ botToken, apiId, apiHash }); }
    catch { return null; }
}

export async function getEffectiveTelegramBotConfig(): Promise<{
    credentials: TelegramBotCredentials | null;
    configured: boolean;
    enabled: boolean;
    required: boolean;
    source: 'web' | 'environment' | 'none';
}> {
    const webCredentials = await getWebCredentials();
    const environmentCredentials = getEnvironmentCredentials();
    const source = webCredentials ? 'web' : environmentCredentials ? 'environment' : 'none';
    const credentials = webCredentials || environmentCredentials;
    const [enabledRow, requiredRow] = await Promise.all([
        getSettingStrict<string>(TELEGRAM_BOT_ENABLED_SETTING),
        getSettingStrict<string>(TELEGRAM_REQUIRED_SETTING),
    ]);
    return {
        credentials,
        configured: Boolean(credentials),
        enabled: Boolean(credentials) && enabledValue(enabledRow.value, true),
        required: enabledValue(requiredRow.value, enabledValue(process.env.TELEGRAM_REQUIRED, false)),
        source,
    };
}

export async function applyEffectiveTelegramBotConfig(): Promise<Awaited<ReturnType<typeof getEffectiveTelegramBotConfig>>> {
    const effective = await getEffectiveTelegramBotConfig();
    setTelegramBotRequired(effective.required);
    return effective;
}

let lastBotIdentity: TelegramBotPublicConfig['bot'] = null;

export function setTelegramBotIdentity(bot: TelegramBotPublicConfig['bot']): void {
    lastBotIdentity = bot;
}

export async function getTelegramBotPublicConfig(): Promise<TelegramBotPublicConfig> {
    const effective = await getEffectiveTelegramBotConfig();
    const status = getTelegramBotStatus();
    return {
        configured: effective.configured,
        enabled: effective.enabled,
        required: effective.required,
        pinConfigured: await isTelegramPinConfigured(),
        source: effective.source,
        status: status.status,
        bot: lastBotIdentity,
        lastConnectedAt: status.lastConnectedAt,
        lastError: status.lastError,
        action: status.action,
    };
}

export async function testTelegramBotCredentials(credentials: TelegramBotCredentials): Promise<{ username: string | null; displayName: string | null }> {
    const client = new TelegramClient(new StringSession(''), credentials.apiId, credentials.apiHash, {
        connectionRetries: 3,
        retryDelay: 1000,
        useWSS: false,
        deviceModel: 'TG Vault Bot Config Test',
        systemVersion: '1.0.0',
        appVersion: '1.0.0',
    });
    try {
        await client.start({ botAuthToken: credentials.botToken });
        const me: any = await client.getMe();
        return {
            username: me?.username ? String(me.username) : null,
            displayName: [me?.firstName, me?.lastName].filter(Boolean).join(' ') || null,
        };
    } catch {
        throw new Error('无法连接 Telegram Bot，请检查 Token、API ID、API Hash 和网络');
    } finally {
        await client.disconnect().catch(() => undefined);
        await client.destroy().catch(() => undefined);
    }
}

export async function saveTelegramBotConfig(credentials: TelegramBotCredentials, options: { enabled: boolean; required: boolean }): Promise<void> {
    await setSettings([
        [TELEGRAM_BOT_TOKEN_SETTING, credentials.botToken],
        [TELEGRAM_API_ID_SETTING, String(credentials.apiId)],
        [TELEGRAM_API_HASH_SETTING, credentials.apiHash],
        [TELEGRAM_BOT_ENABLED_SETTING, options.enabled ? 'true' : 'false'],
        [TELEGRAM_REQUIRED_SETTING, options.required ? 'true' : 'false'],
    ]);
}

export interface TelegramBotPersistedSnapshot {
    entries: Array<[string, string]>;
}

export async function snapshotTelegramBotConfig(): Promise<TelegramBotPersistedSnapshot> {
    const rows = await Promise.all(ALL_KEYS.map(async key => [key, await getSettingStrict<string>(key)] as const));
    return {
        entries: rows.filter(([, row]) => row.found && row.value !== null).map(([key, row]) => [key, row.value!] as [string, string]),
    };
}

export async function restoreTelegramBotConfig(snapshot: TelegramBotPersistedSnapshot): Promise<void> {
    await deleteSettings(ALL_KEYS);
    if (snapshot.entries.length > 0) await setSettings(snapshot.entries);
}

export function getEnvironmentTelegramBotCredentials(): TelegramBotCredentials {
    const credentials = getEnvironmentCredentials();
    if (!credentials) throw new Error('环境变量中没有完整有效的 Telegram Bot 凭证');
    return credentials;
}

export async function migrateEnvironmentTelegramBotConfig(credentials: TelegramBotCredentials): Promise<void> {
    await saveTelegramBotConfig(credentials, {
        enabled: true,
        required: enabledValue(process.env.TELEGRAM_REQUIRED, false),
    });
}

export async function setTelegramBotEnabled(enabled: boolean): Promise<void> {
    await setSetting(TELEGRAM_BOT_ENABLED_SETTING, enabled ? 'true' : 'false');
}

export async function deleteTelegramBotConfig(): Promise<void> {
    await deleteSettings(ALL_KEYS);
    lastBotIdentity = null;
}
