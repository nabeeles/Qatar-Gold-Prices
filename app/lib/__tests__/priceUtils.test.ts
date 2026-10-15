import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deduplicateLatestPrices,
  computeMarketAverages,
  getHistoricalCutoffIso,
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
