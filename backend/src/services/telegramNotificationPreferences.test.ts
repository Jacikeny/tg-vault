import assert from 'node:assert/strict';
import test from 'node:test';
import {
    DEFAULT_TELEGRAM_NOTIFICATION_PREFERENCES,
    evaluateTelegramNotification,
    isQuietHour,
    normalizeTelegramNotificationPreferences,
} from './telegramNotificationPreferences.js';

const fixed = new Date('2026-08-24T14:30:00.000Z');

test('quiet hours honor user timezone including overnight ranges', () => {
    assert.equal(isQuietHour({ timezone: 'Asia/Shanghai', quietStart: '22:00', quietEnd: '07:00' }, fixed), true);
    assert.equal(isQuietHour({ timezone: 'UTC', quietStart: '22:00', quietEnd: '07:00' }, fixed), false);
});

test('security notifications bypass quiet hours and cannot be disabled', () => {
    const preferences = normalizeTelegramNotificationPreferences({ security: false, timezone: 'Asia/Shanghai', quietStart: '22:00', quietEnd: '07:00' });
    assert.equal(preferences.security, true);
    assert.deepEqual(evaluateTelegramNotification('security', preferences, fixed), { deliver: 'immediate', reason: 'security-bypass' });
});

test('ordinary success can be summarized while failures remain immediate by default', () => {
    const preferences = { ...DEFAULT_TELEGRAM_NOTIFICATION_PREFERENCES, successMode: 'digest' as const };
    assert.deepEqual(evaluateTelegramNotification('success', preferences, fixed), { deliver: 'digest', reason: 'preference' });
    assert.deepEqual(evaluateTelegramNotification('failure', preferences, fixed), { deliver: 'immediate', reason: 'preference' });
});
