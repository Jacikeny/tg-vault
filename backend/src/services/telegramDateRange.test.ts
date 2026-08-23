import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTelegramDateRange } from './telegramDateRange.js';

test('rejects nonexistent and out-of-range calendar dates', () => {
    for (const value of ['2026-02-29', '2026-99-99', '2026-04-31']) {
        assert.throws(() => parseTelegramDateRange(value, value), /有效日期/);
    }
});

test('accepts leap day and returns inclusive UTC boundaries', () => {
    const range = parseTelegramDateRange('2024-02-29', '2024-03-01');
    assert.equal(range.startDate.toISOString(), '2024-02-29T00:00:00.000Z');
    assert.equal(range.endDate.toISOString(), '2024-03-01T23:59:59.999Z');
    assert.equal(range.dayCount, 2);
    assert.equal(range.requiresLargeRangeConfirmation, false);
});

test('rejects reversed ranges and flags a large inclusive range', () => {
    assert.throws(() => parseTelegramDateRange('2026-06-02', '2026-06-01'), /不能晚于/);
    const range = parseTelegramDateRange('2026-01-01', '2026-02-15', { warningThresholdDays: 31 });
    assert.equal(range.dayCount, 46);
    assert.equal(range.requiresLargeRangeConfirmation, true);
});
