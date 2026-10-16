import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deduplicateLatestPrices,
  computeMarketAverages,
  getHistoricalCutoffIso,
  aggregateHistoricalPrices,
  filterHistoricalByTimeframe,
} from '../priceUtils.ts';

test('deduplicateLatestPrices keeps only the most recent entry per provider and karat even when unsorted or using provider_id', () => {
  const rows = [
    { id: 'old-malabar', karat: 24, price: 310, scraped_at: '2026-10-14T12:00:00Z', provider: { name: 'Malabar Gold' } },
    { id: 'new-malabar', karat: 24, price: 320, scraped_at: '2026-10-15T12:00:00Z', provider: { name: 'Malabar Gold' } },
    { id: 'malabar-22', karat: 22, price: 298, scraped_at: '2026-10-15T12:00:00Z', provider: { name: 'Malabar Gold' } },
    { id: 'joyalukkas-id-only', karat: 24, price: 322, scraped_at: '2026-10-15T11:00:00Z', provider_id: 'prov-joy' },
    { id: 'joyalukkas-id-older', karat: 24, price: 305, scraped_at: '2026-10-13T11:00:00Z', provider_id: 'prov-joy' },
  ];

  const deduped = deduplicateLatestPrices(rows);
  assert.equal(deduped.length, 3);
  assert.deepEqual(deduped.map((r) => r.id), ['new-malabar', 'malabar-22', 'joyalukkas-id-only']);
});

test('deduplicateLatestPrices excludes stale karats from an older scrape session when a provider has newer rates', () => {
  const rows = [
    { id: 'malabar-24-today', karat: 24, price: 503.5, scraped_at: '2026-10-16T07:14:02Z', provider: { name: 'Malabar Gold' } },
    { id: 'malabar-22-today', karat: 22, price: 464.5, scraped_at: '2026-10-16T07:14:02Z', provider: { name: 'Malabar Gold' } },
    { id: 'malabar-21-stale', karat: 21, price: 491.11, scraped_at: '2026-09-29T18:46:47Z', provider: { name: 'Malabar Gold' } },
  ];

  const deduped = deduplicateLatestPrices(rows);
  assert.deepEqual(deduped.map((r) => r.id), ['malabar-24-today', 'malabar-22-today']);
});

test('computeMarketAverages averages only the latest deduplicated price per provider for each karat', () => {
  const rows = [
    { id: '1', karat: 24, price: 320, scraped_at: '2026-10-15T12:00:00Z', provider: { name: 'Malabar Gold' } },
    { id: '2', karat: 24, price: 100, scraped_at: '2026-10-01T12:00:00Z', provider: { name: 'Malabar Gold' } }, // stale row should be ignored
    { id: '3', karat: 24, price: 324, scraped_at: '2026-10-15T12:00:00Z', provider: { name: 'Joyalukkas' } },
    { id: '4', karat: 22, price: 300, scraped_at: '2026-10-15T12:00:00Z', provider: { name: 'Malabar Gold' } },
  ];

  const averages = computeMarketAverages(rows);
  assert.equal(averages[24], 322);
  assert.equal(averages[22], 300);
});

test('getHistoricalCutoffIso returns an ISO string N days before reference date', () => {
  const ref = new Date('2026-10-15T12:00:00.000Z');
  const cutoff = getHistoricalCutoffIso(35, ref);
  assert.equal(cutoff, '2026-09-10T12:00:00.000Z');
});

test('aggregateHistoricalPrices computes daily averages sorted ascending by timestamp', () => {
  const rows = [
    { karat: 24, price: 504, scraped_at: '2026-10-16T10:18:22Z' },
    { karat: 24, price: 502, scraped_at: '2026-10-16T07:14:02Z' },
    { karat: 24, price: 510, scraped_at: '2026-09-29T18:46:47Z' },
    { karat: 24, price: 512, scraped_at: '2026-09-29T12:00:00Z' },
  ];

  const series = aggregateHistoricalPrices(rows);
  assert.equal(series.length, 2);
  assert.equal(series[0].value, 511);
  assert.equal(series[1].value, 503);
  assert.ok(series[0].timestamp < series[1].timestamp);
});

test('filterHistoricalByTimeframe falls back to recent historical points when strict cutoff has fewer than 2 points', () => {
  const nowMs = new Date('2026-10-16T12:00:00Z').getTime();
  const points = [
    { timestamp: new Date('2026-08-01T12:00:00Z').getTime(), value: 480 },
    { timestamp: new Date('2026-08-02T12:00:00Z').getTime(), value: 485 },
    { timestamp: new Date('2026-08-03T12:00:00Z').getTime(), value: 490 },
    { timestamp: new Date('2026-09-29T12:00:00Z').getTime(), value: 511 },
    { timestamp: new Date('2026-10-16T10:18:22Z').getTime(), value: 503 },
  ];

  // For 7d, only 2026-10-16 is inside the strict 7-day window (1 point < 2),
  // so it should fall back to the most recent points (up to 7) so the chart can render.
  const weekChart = filterHistoricalByTimeframe(points, '7d', nowMs);
  assert.equal(weekChart.length, 5);
  assert.equal(weekChart[weekChart.length - 1].value, 503);

  // For 30d, 2026-09-29 and 2026-10-16 are both within 30 days (2 points >= 2).
  const monthChart = filterHistoricalByTimeframe(points, '30d', nowMs);
  assert.equal(monthChart.length, 2);

  // For 365d, all 5 points are within 365 days.
  const yearChart = filterHistoricalByTimeframe(points, '365d', nowMs);
  assert.equal(yearChart.length, 5);
});

test('filterHistoricalByTimeframe synthesizes a 2-point flat line when only 1 historical point exists in total', () => {
  const nowMs = new Date('2026-10-16T12:00:00Z').getTime();
  const singlePoint = [
    { timestamp: new Date('2026-10-16T10:18:22Z').getTime(), value: 503 },
  ];

  const chart = filterHistoricalByTimeframe(singlePoint, '7d', nowMs);
  assert.equal(chart.length, 2);
  assert.equal(chart[0].value, 503);
  assert.equal(chart[1].value, 503);
  assert.ok(chart[0].timestamp < chart[1].timestamp);
});

