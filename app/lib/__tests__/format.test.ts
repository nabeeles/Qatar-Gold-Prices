import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatCurrency, parseLocalDate } from '../format.ts';

describe('formatCurrency', () => {
  it('formats integers with strictly two decimal places', () => {
    assert.equal(formatCurrency(580), '580.00');
  });

  it('rounds floating point numbers to two decimal places', () => {
    assert.equal(formatCurrency(584.333333), '584.33');
    assert.equal(formatCurrency(584.339), '584.34');
  });

  it('includes thousands separators for large values', () => {
    assert.equal(formatCurrency(12345.6), '12,345.60');
  });

  it('returns 0.00 for NaN or non-finite values', () => {
    assert.equal(formatCurrency(Number.NaN), '0.00');
    assert.equal(formatCurrency(Number.POSITIVE_INFINITY), '0.00');
  });
});

describe('parseLocalDate', () => {
  it('parses YYYY-MM-DD in local time without UTC day shift', () => {
    const d = parseLocalDate('2026-10-15');
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 9); // 0-indexed October
    assert.equal(d.getDate(), 15);
  });

  it('falls back to standard Date parsing for full ISO timestamps', () => {
    const d = parseLocalDate('2026-10-15T12:30:00.000Z');
    assert.equal(Number.isNaN(d.getTime()), false);
  });
});
