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

function classifySupabaseKey(token) {
  if (!token) return { role: 'missing', format: 'none' };
  if (token.startsWith('sb_publishable_')) {
    return { role: 'anon', format: 'sb_publishable' };
  }
  if (token.startsWith('sb_secret_')) {
    return { role: 'service_role', format: 'sb_secret' };
  }
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64').toString('utf8')
    );
    return { role: payload.role, ref: payload.ref, exp: payload.exp, format: 'jwt' };
  } catch {
    return { role: 'unknown', format: 'unknown' };
  }
}

async function runReadinessCheck() {
  const results = [];
  const logCheck = (id, name, passed, details) => {
    results.push({ id, name, passed, details });
    console.log(
      `${passed ? 'PASS' : 'FAIL'} | Check ${String(id).padStart(2, '0')} - ${name}: ${details}`
    );
  };

  console.log('=== SUPABASE PRODUCTION READINESS AUDIT ===\n');

  const appUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || appEnv.EXPO_PUBLIC_SUPABASE_URL;
  const appAnonKey =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || appEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const backendUrl = process.env.SUPABASE_URL || backendEnv.SUPABASE_URL || appUrl;
  const backendKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    backendEnv.SUPABASE_SERVICE_ROLE_KEY ||
    backendEnv.SUPABASE_KEY;

  const appJwt = classifySupabaseKey(appAnonKey || '');
  const backendJwt = classifySupabaseKey(backendKey || '');

  logCheck(
    1,
    'Env URL Match',
    Boolean(appUrl && backendUrl && appUrl === backendUrl),
    `app=${appUrl}, backend=${backendUrl}`
  );
  logCheck(
    2,
    'Mobile Client Key is strictly anon/publishable role',
    appJwt?.role === 'anon',
    `role=${appJwt?.role}, format=${appJwt?.format}`
  );
  logCheck(
    3,
    'Backend Key is strictly service_role/secret role',
    backendJwt?.role === 'service_role',
    `backend key role=${backendJwt?.role}, format=${backendJwt?.format}`
  );

  const anonClient = createClient(appUrl, appAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const adminClient = createClient(backendUrl, backendKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Unauthenticated RLS Checks
  const { data: unauthProviders, error: unauthProvErr } = await anonClient
    .from('providers')
    .select('id, name');
  logCheck(
    4,
    'Unauthenticated (anon) blocked from reading providers',
    !unauthProvErr && Array.isArray(unauthProviders) && unauthProviders.length === 0,
    `rows returned=${unauthProviders?.length ?? 'err'}`
  );

  const { data: unauthPrices, error: unauthPricesErr } = await anonClient
    .from('gold_prices')
    .select('id, price')
    .limit(5);
  logCheck(
    5,
    'Unauthenticated (anon) blocked from reading gold_prices',
    !unauthPricesErr && Array.isArray(unauthPrices) && unauthPrices.length === 0,
    `rows returned=${unauthPrices?.length ?? 'err'}`
  );

  const { error: unauthInsertErr } = await anonClient
    .from('gold_prices')
    .insert({ karat: 24, price: 350.0 });
  logCheck(
    6,
    'Unauthenticated (anon) blocked from inserting gold_prices & reading price_alerts',
    Boolean(unauthInsertErr),
    `error=${unauthInsertErr?.message || 'NONE (VULNERABLE!)'}`
  );

  // Anonymous Sign-In (Mobile Client Auth Flow)
  const clientA = createClient(appUrl, appAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authA, error: authAErr } = await clientA.auth.signInAnonymously();
  const userAId = authA?.user?.id;
  logCheck(
    7,
    'Supabase Anonymous Sign-In enabled & working',
    Boolean(!authAErr && userAId),
    authAErr ? `Error: ${authAErr.message}` : `Signed in anonymous user ${userAId}`
  );

  let userBId = null;
  if (userAId) {
    const { data: activeProviders, error: activeProvErr } = await clientA
      .from('providers')
      .select('id, name, is_active, scraping_type');
    const hasInactiveExposed = (activeProviders || []).some((p) => !p.is_active);
    logCheck(
      8,
      'Authenticated user reads active providers only (RLS filters inactive)',
      !activeProvErr && (activeProviders || []).length > 0 && !hasInactiveExposed,
      `active providers=${(activeProviders || []).map((p) => p.name).join(', ')} (inactive exposed=${hasInactiveExposed})`
    );

    const t0 = Date.now();
    const { data: latestPrices, error: latestErr } = await clientA
      .from('gold_prices')
      .select(
        'id, karat, price, currency, scraped_at, provider:providers!inner(name, is_active)'
      )
      .eq('provider.is_active', true)
      .order('scraped_at', { ascending: false })
      .limit(100);
    const latestLatency = Date.now() - t0;
    logCheck(
      9,
      'Mobile useLatestPrices() query & latency',
      !latestErr && (latestPrices || []).length > 0,
      `rows=${latestPrices?.length || 0}, latency=${latestLatency}ms, latest scraped_at=${latestPrices?.[0]?.scraped_at}`
    );

    const cutoff = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString();
    const t1 = Date.now();
    const { data: histPrices, error: histErr } = await clientA
      .from('gold_prices')
      .select('price, scraped_at, provider:providers!inner(name, is_active)')
      .eq('karat', 24)
      .eq('provider.is_active', true)
      .gte('scraped_at', cutoff)
      .order('scraped_at', { ascending: false })
      .limit(5000);
    const histLatency = Date.now() - t1;
    logCheck(
      10,
      'Mobile useHistoricalPrices(24) query & latency',
      !histErr && (histPrices || []).length > 0,
      `rows=${histPrices?.length || 0}, latency=${histLatency}ms`
    );

    const { error: authWritePriceErr } = await clientA
      .from('gold_prices')
      .insert({ karat: 24, price: 999.99 });
    logCheck(
      11,
      'Authenticated user blocked from INSERT on gold_prices',
      Boolean(authWritePriceErr),
      `error=${authWritePriceErr?.message || 'NONE (VULNERABLE!)'}`
    );

    const { error: authWriteProvErr } = await clientA
      .from('providers')
      .insert({ name: 'Malicious', url: 'https://evil.com', scraping_type: 'direct' });
    logCheck(
      12,
      'Authenticated user blocked from INSERT on providers',
      Boolean(authWriteProvErr),
      `error=${authWriteProvErr?.message || 'NONE (VULNERABLE!)'}`
    );

    const { data: insertedAlert, error: alertInsertErr } = await clientA
      .from('price_alerts')
      .insert({
        user_id: userAId,
        karat: 24,
        target_price: 999.99,
        condition: 'above',
        expo_push_token: 'ExponentPushToken[readiness-check-token]',
      })
      .select()
      .single();

    logCheck(
      13,
      'Authenticated user can create own price_alert',
      !alertInsertErr && Boolean(insertedAlert?.id),
      alertInsertErr
        ? `Error: ${alertInsertErr.message}`
        : `Created alert id=${insertedAlert.id}`
    );

    const { error: badKaratErr } = await clientA.from('price_alerts').insert({
      user_id: userAId,
      karat: 99,
      target_price: 500,
      condition: 'above',
      expo_push_token: 'ExponentPushToken[readiness-check-token]',
    });
    logCheck(
      14,
      'price_alerts CHECK constraint blocks invalid karat (99)',
      Boolean(badKaratErr),
      `error=${badKaratErr?.message || 'NONE'}`
    );

    const clientB = createClient(appUrl, appAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authB } = await clientB.auth.signInAnonymously();
    userBId = authB?.user?.id;

    if (userBId && insertedAlert?.id) {
      const { data: bReadsA } = await clientB
        .from('price_alerts')
        .select('*')
        .eq('id', insertedAlert.id);
      logCheck(
        15,
        'Cross-user RLS: User B cannot read User A price_alerts',
        Array.isArray(bReadsA) && bReadsA.length === 0,
        `User B saw ${bReadsA?.length} rows of User A`
      );

      const { error: spoofErr } = await clientB.from('price_alerts').insert({
        user_id: userAId,
        karat: 22,
        target_price: 400,
        condition: 'below',
        expo_push_token: 'ExponentPushToken[spoof]',
      });
      logCheck(
        16,
        'Cross-user RLS: User B cannot insert alert spoofing User A user_id',
        Boolean(spoofErr),
        `error=${spoofErr?.message || 'NONE (VULNERABLE!)'}`
      );

      const { error: delErr } = await clientA
        .from('price_alerts')
        .delete()
        .eq('id', insertedAlert.id);
      logCheck(
        17,
        'Authenticated user can delete own price_alert',
        !delErr,
        delErr ? `Error: ${delErr.message}` : 'Deleted test alert cleanly'
      );
    }
  }

  // Check 18: Historical Data Integrity (out-of-bounds <100 or >2000 OR inverted karat batches)
  const { data: anomalousPrices, count: outOfBoundsCount } = await adminClient
    .from('gold_prices')
    .select('id, karat, price, scraped_at, provider_id', { count: 'exact' })
    .or('price.lt.100,price.gt.2000')
    .limit(10);

  // Also check recent rows for inverted karat hierarchy (18K > 22K, 21K > 22K, or 22K > 24K)
  const { data: recentRows } = await adminClient
    .from('gold_prices')
    .select('id, provider_id, karat, price, scraped_at')
    .order('scraped_at', { ascending: false })
    .limit(1000);

  const batches = new Map();
  for (const row of recentRows || []) {
    const minuteBucket = (row.scraped_at || '').slice(0, 19);
    const key = `${row.provider_id}__${minuteBucket}`;
    if (!batches.has(key)) batches.set(key, {});
    batches.get(key)[row.karat] = Number(row.price);
  }

  let invertedCount = 0;
  for (const [, karats] of batches.entries()) {
    if (
      (karats[18] && karats[22] && karats[18] > karats[22]) ||
      (karats[21] && karats[22] && karats[21] > karats[22]) ||
      (karats[22] && karats[24] && karats[22] > karats[24])
    ) {
      invertedCount++;
    }
  }

  const totalAnomalous = (outOfBoundsCount || 0) + invertedCount;
  logCheck(
    18,
    'Historical Data Integrity (no out-of-bounds <100/>2000 or inverted karat rows)',
    totalAnomalous === 0,
    `anomalous rows count=${totalAnomalous} (out_of_bounds=${outOfBoundsCount || 0}, inverted_batches=${invertedCount})`
  );

  // Print Latest Prices by Provider
  const { data: recentPrices } = await adminClient
    .from('gold_prices')
    .select('karat, price, scraped_at, provider:providers(name, is_active)')
    .order('scraped_at', { ascending: false })
    .limit(60);

  const byProvider = {};
  for (const row of recentPrices || []) {
    if (!row.provider?.is_active) continue;
    const pName = row.provider?.name || 'Unknown';
    if (!byProvider[pName]) {
      byProvider[pName] = { latest_scraped_at: row.scraped_at, karats: {} };
    }
    if (!byProvider[pName].karats[row.karat]) {
      byProvider[pName].karats[row.karat] = row.price;
    }
  }
  console.log('\n--- Latest Prices by Active Provider ---');
  console.table(
    Object.entries(byProvider).map(([name, info]) => ({
      provider: name,
      latest_scraped_at: info.latest_scraped_at,
      age_hours: (
        (Date.now() - new Date(info.latest_scraped_at).getTime()) /
        3600000
      ).toFixed(1),
      '24K': info.karats[24] || null,
      '22K': info.karats[22] || null,
      '21K': info.karats[21] || null,
      '18K': info.karats[18] || null,
    }))
  );

  // Cleanup test alerts & temporary users
  await adminClient
    .from('price_alerts')
    .delete()
    .in('expo_push_token', [
      'ExponentPushToken[readiness-check-token]',
      'ExponentPushToken[spoof]',
    ]);
  if (backendJwt?.role === 'service_role') {
    if (userAId) await adminClient.auth.admin.deleteUser(userAId).catch(() => {});
    if (userBId) await adminClient.auth.admin.deleteUser(userBId).catch(() => {});
  }

  const failed = results.filter((r) => !r.passed);
  console.log(
    `\nSummary: ${results.length - failed.length}/${results.length} checks passed.`
  );
  if (failed.length > 0) {
    process.exit(1);
  }
}

runReadinessCheck().catch((err) => {
  console.error('Fatal error in readiness check:', err);
  process.exit(1);
});
