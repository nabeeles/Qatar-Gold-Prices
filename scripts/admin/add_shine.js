const { supabase } = require('./db');

/**
 * Administrative provisioning script for Shine Jewelers.
 * 
 * Objective: 
 * Ensures the 'Shine Jewelers' retail provider is correctly initialized 
 * in the database with the appropriate scraping configuration.
 * 
 * @async
 * @function addShine
 * @description Validates existing records and provisions the Shine Jewelers entry if missing.
 */
async function addShine() {
  console.log('--- Provisioning Retail Source: Shine Jewelers ---');
  
  const { data: existing } = await supabase
    .from('providers')
    .select('id')
    .eq('name', 'Shine Jewelers')
    .single();

  if (!existing) {
      const { error } = await supabase
        .from('providers')
        .insert({
            name: 'Shine Jewelers',
            url: 'https://shine.qa/goldrate',
            scraping_type: 'direct',
            selectors: { "24k": "24k", "22k": "22k" }
        });
      if (error) console.error('[Provisioning] Error adding institution Shine Jewelers:', error.message);
      else console.log('✅ Institution Shine Jewelers added successfully.');
  } else {
      console.log('ℹ️  Institution Shine Jewelers already exists in registry.');
  }
}

addShine();
