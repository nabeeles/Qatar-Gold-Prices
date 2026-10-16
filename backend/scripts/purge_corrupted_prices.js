const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

const appEnvPath = path.resolve(__dirname, '../../app/.env');
const backendEnvPath = path.resolve(__dirname, '../.env');

const appEnv = fs.existsSync(appEnvPath)
  ? dotenv.parse(fs.readFileSync(appEnvPath, 'utf8'))
  : {};
const backendEnv = fs.existsSync(backendEnvPath)
  ? dotenv.parse(fs.readFileSync(backendEnvPath, 'utf8'))
  : {};

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  backendEnv.SUPABASE_URL ||
  appEnv.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  backendEnv.SUPABASE_SERVICE_ROLE_KEY ||
  backendEnv.SUPABASE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY / SUPABASE_KEY.');
  process.exit(1);
}

const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function purgeCorruptedPrices() {
  console.log('=== PURGING CORRUPTED HISTORICAL GOLD PRICES ===\n');

  // 1. Delete out-of-bounds rows (price < 100 or price > 2000)
  const { data: outOfBoundsRows, error: selectErr } = await adminClient
    .from('gold_prices')
    .select('id, provider_id, karat, price, scraped_at')
    .or('price.lt.100,price.gt.2000');

  if (selectErr) {
    throw new Error(`Failed to query out-of-bounds prices: ${selectErr.message}`);
  }

  console.log(`Found ${outOfBoundsRows?.length || 0} out-of-bounds rows (<100 or >2000 QAR/g).`);

  if (outOfBoundsRows && outOfBoundsRows.length > 0) {
    const ids = outOfBoundsRows.map((r) => r.id);
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const { error: delErr } = await adminClient
        .from('gold_prices')
        .delete()
        .in('id', chunk);
      if (delErr) {
        throw new Error(`Failed to delete out-of-bounds chunk: ${delErr.message}`);
      }
    }
    console.log(`Deleted ${ids.length} out-of-bounds rows.`);
  }

  // 2. Scan all remaining rows for inverted karat hierarchy within each scrape batch
  let allRows = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data: page, error: pageErr } = await adminClient
      .from('gold_prices')
      .select('id, provider_id, karat, price, scraped_at')
      .order('scraped_at', { ascending: false })
      .range(from, from + pageSize - 1);

    if (pageErr) {
      throw new Error(`Failed to fetch gold_prices page: ${pageErr.message}`);
    }
    if (!page || page.length === 0) break;
    allRows = allRows.concat(page);
    if (page.length < pageSize) break;
    from += pageSize;
  }

  const batches = new Map();
  for (const row of allRows) {
    const minuteBucket = (row.scraped_at || '').slice(0, 19);
    const key = `${row.provider_id}__${minuteBucket}`;
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(row);
  }

  const invertedRowIds = new Set();
  let invertedBatchCount = 0;

  for (const [, rows] of batches.entries()) {
    const byKarat = {};
    for (const r of rows) {
      byKarat[r.karat] = Number(r.price);
    }

    const isInverted =
      (byKarat[18] && byKarat[21] && byKarat[18] > byKarat[21]) ||
      (byKarat[18] && byKarat[22] && byKarat[18] > byKarat[22]) ||
      (byKarat[18] && byKarat[24] && byKarat[18] > byKarat[24]) ||
      (byKarat[21] && byKarat[22] && byKarat[21] > byKarat[22]) ||
      (byKarat[21] && byKarat[24] && byKarat[21] > byKarat[24]) ||
      (byKarat[22] && byKarat[24] && byKarat[22] > byKarat[24]);

    if (isInverted) {
      invertedBatchCount++;
      // If 24K and 22K are valid (24K >= 22K), only delete the offending lower karats (21K / 18K) if they exceed 22K;
      // otherwise delete the entire corrupted batch.
      if (byKarat[24] && byKarat[22] && byKarat[24] >= byKarat[22]) {
        for (const r of rows) {
          if (
            (r.karat === 21 && Number(r.price) > byKarat[22]) ||
            (r.karat === 18 &&
              (Number(r.price) > byKarat[22] ||
                (byKarat[21] &&
                  byKarat[21] <= byKarat[22] &&
                  Number(r.price) > byKarat[21])))
          ) {
            invertedRowIds.add(r.id);
          }
        }
      } else {
        for (const r of rows) {
          invertedRowIds.add(r.id);
        }
      }
    }
  }

  console.log(
    `Found ${invertedBatchCount} batches with inverted karat hierarchy (${invertedRowIds.size} corrupted rows).`
  );

  if (invertedRowIds.size > 0) {
    const ids = Array.from(invertedRowIds);
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const { error: delErr } = await adminClient
        .from('gold_prices')
        .delete()
        .in('id', chunk);
      if (delErr) {
        throw new Error(`Failed to delete inverted karat rows: ${delErr.message}`);
      }
    }
    console.log(`Deleted ${ids.length} inverted karat rows.`);
  }

  console.log('Data hygiene purge complete.');
}

purgeCorruptedPrices().catch((err) => {
  console.error('Fatal purge error:', err);
  process.exit(1);
});
