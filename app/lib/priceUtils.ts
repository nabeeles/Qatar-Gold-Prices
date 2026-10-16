export interface PriceRowLike {
  karat: number;
  price?: number;
  price_per_gram?: number;
  provider_id?: string | number;
  scraped_at?: string;
  provider?: { name?: string } | null;
}

/**
 * Keeps only the most recent price row for each (provider, karat) pair,
 * sorting by `scraped_at` descending when timestamps are present.
 */
export function deduplicateLatestPrices<T extends PriceRowLike>(rows: T[]): T[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const sorted = [...rows].sort((a, b) => {
    const tA = a.scraped_at ? new Date(a.scraped_at).getTime() : 0;
    const tB = b.scraped_at ? new Date(b.scraped_at).getTime() : 0;
    return tB - tA;
  });

  const seen = new Set<string>();
  const latestProviderMs = new Map<string, number>();
  const result: T[] = [];

  for (const row of sorted) {
    const providerKey = row.provider?.name || String(row.provider_id ?? 'unknown');
    const rowMs = row.scraped_at ? new Date(row.scraped_at).getTime() : 0;

    if (rowMs > 0) {
      const newestForProvider = latestProviderMs.get(providerKey);
      if (newestForProvider === undefined) {
        latestProviderMs.set(providerKey, rowMs);
      } else if (newestForProvider - rowMs > 60 * 60 * 1000) {
        // Skip stale karat rows from an older scrape session (>1 hour older than provider's latest scrape)
        continue;
      }
    }

    const key = `${providerKey}:${row.karat}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(row);
    }
  }

  return result;
}

/**
 * Computes the average price per gram for each karat across active providers'
 * latest deduplicated rates.
 */
export function computeMarketAverages<T extends PriceRowLike>(rows: T[]): Record<number, number> {
  const deduped = deduplicateLatestPrices(rows);
  const buckets: Record<number, { total: number; count: number }> = {};

  for (const row of deduped) {
    const val = Number(row.price ?? row.price_per_gram ?? 0);
    if (!Number.isFinite(val) || val <= 0) continue;
    if (!buckets[row.karat]) {
      buckets[row.karat] = { total: 0, count: 0 };
    }
    buckets[row.karat].total += val;
    buckets[row.karat].count += 1;
  }

  const averages: Record<number, number> = {};
  for (const [karatStr, data] of Object.entries(buckets)) {
    const karat = Number(karatStr);
    averages[karat] = data.count > 0 ? data.total / data.count : 0;
  }

  return averages;
}

/**
 * Returns an ISO-8601 UTC timestamp `days` prior to `now` for bounding historical queries.
 */
export function getHistoricalCutoffIso(days = 35, now: Date = new Date()): string {
  const ms = days * 24 * 60 * 60 * 1000;
  return new Date(now.getTime() - ms).toISOString();
}
