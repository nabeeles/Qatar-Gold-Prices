const path = require('path');
const fs = require('fs');

// Only load .env if it exists (for local development)
const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
}

/** 
 * Authenticated Supabase client for database operations.
 * Uses the service role key for full database access.
 */
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Fetches all active gold price providers from the providers table.
 * @returns {Promise<Array<Object>>} - List of active provider records.
 */
async function getActiveProviders() {
  const { data, error } = await supabase
    .from('providers')
    .select('*')
    .eq('is_active', true);

  if (error) throw error;
  return data;
}

/**
 * Saves multiple gold price records for a specific provider.
 * 
 * - Parses price object to extract karat values (e.g., '24k' -> 24).
 * - Inserts entries into the gold_prices table.
 * - Updates the last_scraped_at timestamp in the providers table.
 * 
 * @param {number} providerId - The ID of the provider.
 * @param {Object} prices - Mapping of karats to price strings.
 */
async function savePrices(providerId, prices) {
  const records = [];
  
  // Dynamically map all available carats (24k, 22k, 21k, 18k, etc.)
  Object.keys(prices).forEach(key => {
    const karatMatch = key.match(/^(\d+)k$/i);
    if (karatMatch && prices[key]) {
      records.push({
        provider_id: providerId,
        karat: parseInt(karatMatch[1]),
        price: parseFloat(prices[key]),
        currency: 'QAR'
      });
    }
  });

  if (records.length === 0) return;

  const { error: insertError } = await supabase
    .from('gold_prices')
    .insert(records);

  if (insertError) throw insertError;

  const { error: updateError } = await supabase
    .from('providers')
    .update({ last_scraped_at: new Date().toISOString() })
    .eq('id', providerId);

  if (updateError) throw updateError;
}

module.exports = { supabase, getActiveProviders, savePrices };
