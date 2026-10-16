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
export function getHistoricalCutoffIso(days = 365, now: Date = new Date()): string {
  const ms = days * 24 * 60 * 60 * 1000;
  return new Date(now.getTime() - ms).toISOString();
}

export interface HistoricalPoint {
  timestamp: number;
  value: number;
}

/**
 * Aggregates raw `gold_prices` rows by calendar day into spot average points,
 * sorted ascending by timestamp. If all rows belong to a single calendar day
 * with multiple intraday scrape batches, falls back to minute-level batch buckets.
 */
export function aggregateHistoricalPrices<T extends { price?: number; price_per_gram?: number; scraped_at?: string }>(
  rows: T[]
): HistoricalPoint[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const dailyMap: Record<string, { total: number; count: number; timestamp: number }> = {};
  const batchMap: Record<string, { total: number; count: number; timestamp: number }> = {};

  for (const item of rows) {
    if (!item || !item.scraped_at) continue;
    const price = Number(item.price ?? item.price_per_gram ?? 0);
    const ts = new Date(item.scraped_at).getTime();
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(ts)) continue;

    const dateKey = item.scraped_at.split('T')[0];
    if (!dailyMap[dateKey]) {
      dailyMap[dateKey] = { total: 0, count: 0, timestamp: ts };
    } else if (ts > dailyMap[dateKey].timestamp) {
      dailyMap[dateKey].timestamp = ts;
    }
    dailyMap[dateKey].total += price;
    dailyMap[dateKey].count += 1;

    const batchKey = item.scraped_at.slice(0, 16);
    if (!batchMap[batchKey]) {
      batchMap[batchKey] = { total: 0, count: 0, timestamp: ts };
    } else if (ts > batchMap[batchKey].timestamp) {
      batchMap[batchKey].timestamp = ts;
    }
    batchMap[batchKey].total += price;
    batchMap[batchKey].count += 1;
  }

  const dailyPoints = Object.values(dailyMap)
    .map((day) => ({
      value: day.total / day.count,
      timestamp: day.timestamp,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  if (dailyPoints.length >= 2) {
    return dailyPoints;
  }

  const batchPoints = Object.values(batchMap)
    .map((batch) => ({
      value: batch.total / batch.count,
      timestamp: batch.timestamp,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  return batchPoints.length >= 2 ? batchPoints : dailyPoints;
}

/**
 * Filters aggregated historical points for the selected timeframe (`7d`, `30d`, `365d`).
 *
 * When recent scrapes are sparse and fewer than 2 points fall inside the strict
 * calendar cutoff window, falls back to the most recent recorded points so that
 * `LineChart` always receives a valid >= 2 point series whenever historical data exists.
 */
export function filterHistoricalByTimeframe(
  points: HistoricalPoint[],
  timeframe: string,
  nowMs: number = Date.now()
): HistoricalPoint[] {
  if (!Array.isArray(points) || points.length === 0) return [];

  const valid = points
    .filter((d) => d && Number.isFinite(d.timestamp) && Number.isFinite(Number(d.value)) && Number(d.value) > 0)
    .map((d) => ({ timestamp: d.timestamp, value: Number(d.value) }))
    .sort((a, b) => a.timestamp - b.timestamp);

  if (valid.length === 0) return [];

  const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 365;
  const cutoff = nowMs - days * 24 * 60 * 60 * 1000;

  if (valid.length === 1) {
    const only = valid[0];
    const anchorTimestamp = Math.min(cutoff, only.timestamp - 24 * 60 * 60 * 1000);
    return [
      { timestamp: anchorTimestamp, value: only.value },
      only,
    ];
  }

  const inWindow = valid.filter((d) => d.timestamp >= cutoff);
  if (inWindow.length >= 2) {
    return inWindow;
  }

  const fallbackCount = Math.max(2, Math.min(valid.length, days));
  return valid.slice(-fallbackCount);
}

