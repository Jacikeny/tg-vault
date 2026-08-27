import assert from 'node:assert/strict';
import {
    changeTelegramPinWithClient,
    changeWebPasswordAndRevokeSessionsWithClient,
    createInitialAdminCredentialsWithClient,
} from './authSettings.js';
import { encryptSettingValue, isEncryptedCredential } from './credentialCrypto.js';
import crypto from 'node:crypto';

const calls: Array<{ text: string; params?: unknown[] }> = [];
const fakeClient = {
    async query(text: string, params?: unknown[]) {
        calls.push({ text, params });
        if (/SELECT value/.test(text)) return { rows: [], rowCount: 0 };
        return { rows: [], rowCount: 1 };
    },
};

await createInitialAdminCredentialsWithClient(fakeClient as any, 'password-123', '1234');
assert.match(calls[0].text, /pg_advisory_xact_lock/);
assert.equal(calls.filter(call => /INSERT INTO system_settings/.test(call.text)).length, 2);
assert.ok(calls.every(call => !/COMMIT|ROLLBACK|BEGIN/.test(call.text)), 'transaction ownership belongs to the caller');

calls.length = 0;
await createInitialAdminCredentialsWithClient(fakeClient as any, 'password-789');
assert.equal(calls.filter(call => /INSERT INTO system_settings/.test(call.text)).length, 1);

const initializedClient = {
    async query(text: string) {
        if (/SELECT value/.test(text)) return { rows: [{ value: 'already' }], rowCount: 1 };
        return { rows: [], rowCount: 1 };
    },
};
await assert.rejects(
    () => createInitialAdminCredentialsWithClient(initializedClient as any, 'password-456', '5678'),
    /管理员密码已创建/,
);

function legacyHash(secret: string): string {
    return crypto.createHash('sha256').update(secret).digest('hex');
}

const pinChangeCalls: Array<{ text: string; params?: unknown[] }> = [];
const pinChangeClient = {
    async query(text: string, params?: unknown[]) {
        pinChangeCalls.push({ text, params });
        if (/SELECT key, value/.test(text)) return {
            rows: [
                { key: 'telegram_pin_hash', value: legacyHash('1234') },
                { key: 'admin_password_hash', value: legacyHash('password-123') },
            ],
            rowCount: 2,
        };
        return { rows: [], rowCount: 1 };
    },
};
await changeTelegramPinWithClient(pinChangeClient as any, 'current_pin', '1234', '5678');
assert.ok(pinChangeCalls.some(call => /INSERT INTO system_settings/.test(call.text)));
assert.ok(pinChangeCalls.some(call => /DELETE FROM telegram_auth/.test(call.text)));

pinChangeCalls.length = 0;
await changeTelegramPinWithClient(pinChangeClient as any, 'web_password', 'password-123', '6789');
assert.ok(pinChangeCalls.some(call => /INSERT INTO system_settings/.test(call.text)));

await assert.rejects(
    () => changeTelegramPinWithClient(pinChangeClient as any, 'current_pin', '0000', '5678'),
    /当前 PIN 或网页管理员密码不正确/,
);
await assert.rejects(
    () => changeTelegramPinWithClient(pinChangeClient as any, 'web_password', 'wrong-password', '5678'),
    /当前 PIN 或网页管理员密码不正确/,
);
await assert.rejects(
    () => changeTelegramPinWithClient(pinChangeClient as any, 'current_pin', '1234', '1234'),
    /新 PIN 不能与当前 PIN 相同/,
);

const firstPinCalls: Array<{ text: string; params?: unknown[] }> = [];
const firstPinClient = {
    async query(text: string, params?: unknown[]) {
        firstPinCalls.push({ text, params });
        if (/SELECT key, value/.test(text)) return {
            rows: [{ key: 'admin_password_hash', value: legacyHash('password-123') }],
            rowCount: 1,
        };
        return { rows: [], rowCount: 1 };
    },
};
await changeTelegramPinWithClient(firstPinClient as any, 'web_password', 'password-123', '2468');
assert.ok(firstPinCalls.some(call => /INSERT INTO system_settings/.test(call.text)));
await assert.rejects(
    () => changeTelegramPinWithClient(firstPinClient as any, 'current_pin', '1234', '2468'),
    /首次设置 PIN 必须使用网页管理员密码验证/,
);

const currentWebPasswordHash = legacyHash('password-123');
const encryptedCurrentWebPasswordHash = encryptSettingValue('admin_password_hash', currentWebPasswordHash);
const webPasswordChangeCalls: Array<{ text: string; params?: unknown[] }> = [];
const webPasswordChangeClient = {
    async query(text: string, params?: unknown[]) {
        webPasswordChangeCalls.push({ text, params });
        if (/SELECT value/.test(text)) return {
            rows: [{ value: encryptedCurrentWebPasswordHash }],
            rowCount: 1,
        };
        return { rows: [], rowCount: 1 };
    },
};
await changeWebPasswordAndRevokeSessionsWithClient(
    webPasswordChangeClient as any,
    'password-123',
    'password-456',
);
const passwordUpdate = webPasswordChangeCalls.find(call => /UPDATE system_settings/.test(call.text));
assert.ok(passwordUpdate, 'password hash is updated');
assert.ok(isEncryptedCredential(passwordUpdate.params?.[1]), 'updated password hash remains encrypted at rest');
assert.ok(webPasswordChangeCalls.some(call => /DELETE FROM web_sessions/.test(call.text)), 'all web sessions are revoked');
await assert.rejects(
    () => changeWebPasswordAndRevokeSessionsWithClient(
        webPasswordChangeClient as any,
        'wrong-password',
        'password-456',
    ),
    /当前密码不正确/,
);

console.log('atomic admin setup ok');
