import { query } from '../db/index.js';
import { decryptSettingValue, encryptSettingValue } from './credentialCrypto.js';

/**
 * 获取系统设置
 */
export async function getSetting<T = string>(key: string, defaultValue?: T): Promise<T | null> {
    try {
        const res = await query('SELECT value FROM system_settings WHERE key = $1', [key]);
        if (res.rowCount === 0) {
            return defaultValue ?? null;
        }
        return decryptSettingValue(key, res.rows[0].value) as T;
    } catch (e) {
        console.error(`获取设置 ${key} 失败:`, e);
        return defaultValue ?? null;
    }
}

export async function getSettingStrict<T = string>(key: string): Promise<{ found: boolean; value: T | null }> {
    const res = await query('SELECT value FROM system_settings WHERE key = $1', [key]);
    if (res.rowCount === 0) return { found: false, value: null };
    return { found: true, value: decryptSettingValue(key, res.rows[0].value) as T };
}

/**
 * 保存系统设置
 */
export async function setSetting(key: string, value: string): Promise<void> {
    try {
        await query(
            'INSERT INTO system_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()',
            [key, encryptSettingValue(key, value)]
        );
    } catch (e) {
        console.error(`保存设置 ${key} 失败:`, e);
        throw e;
    }
}

export async function setSettings(entries: Array<[string, string]>): Promise<void> {
    if (entries.length === 0) return;
    const keys = entries.map(([key]) => key);
    const values = entries.map(([key, value]) => encryptSettingValue(key, value));
    await query(
        `INSERT INTO system_settings (key, value)
         SELECT * FROM UNNEST($1::text[], $2::text[])
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [keys, values],
    );
}

export async function deleteSettings(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await query('DELETE FROM system_settings WHERE key = ANY($1::text[])', [keys]);
}
