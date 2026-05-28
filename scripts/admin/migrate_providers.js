const { supabase } = require('./db');

/**
 * Administrative utility to orchestrate the migration and configuration of data providers.
 * 
 * Objectives:
 * 1. Synchronize provider scraping strategies (e.g., migrating Aggregators to Direct Puppeteer flows).
 * 2. Refine CSS selectors for established retail institutions like Al Fardan.
 * 3. Provision new regional providers like Malabar Gold with interactive selection logic.
 * 
 * @async
 * @function migrate
 * @description Executes a multi-stage migration script to ensure the provider registry matches the latest extraction capabilities.
 */
async function migrate() {
  console.log('--- Commencing Administrative Provider Migration ---');
  
  // 1. Logic: Transition GoodReturns from static to dynamic Puppeteer extraction for higher fidelity.
  const { error: err1 } = await supabase
    .from('providers')
    .update({ scraping_type: 'direct' })
    .eq('name', 'GoodReturns Aggregator');
  
  if (err1) console.error('[Migration] Failed to update GoodReturns configuration:', err1.message);
  else console.log('✅ GoodReturns synchronized with Puppeteer strategy.');

  // 2. Logic: Enforce strict label matching for Al Fardan Exchange to mitigate parsing noise.
  const { error: err2 } = await supabase
    .from('providers')
    .update({ selectors: { "24k": "24 KARAT", "22k": "22 KARAT" } })
    .eq('name', 'Al Fardan Exchange');

  if (err2) console.error('[Migration] Failed to refine Al Fardan selectors:', err2.message);
  else console.log('✅ Al Fardan selectors standardized.');

  // 3. Logic: Provisioning Malabar Gold as a primary regional data source with interactive state requirements.
  const { data: existingMalabar } = await supabase
    .from('providers')
    .select('id')
    .eq('name', 'Malabar Gold')
    .single();

  if (!existingMalabar) {
      const { error: err3 } = await supabase
        .from('providers')
        .insert({
            name: 'Malabar Gold',
            url: 'https://www.malabargoldanddiamonds.com/ae/stores/qatar',
            scraping_type: 'direct',
            selectors: { "24k": "24K", "22k": "22K", "interactive": true }
        });
      if (err3) console.error('[Migration] Failed to provision Malabar Gold:', err3.message);
      else console.log('✅ Malabar Gold provisioned successfully.');
  }

  console.log('--- Administrative Migration Cycle Finished ---');
}

migrate();
