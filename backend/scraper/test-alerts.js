const { supabase } = require('./utils/db');
const { checkAndSendAlerts } = require('./utils/alerts');

/**
 * Manual Test Script for Price Alert System
 * 
 * This script:
 * 1. Inserts a dummy alert into Supabase.
 * 2. Simulates a price drop that triggers the alert.
 * 3. Verifies if 'checkAndSendAlerts' picks it up.
 * 4. Cleans up by deleting the dummy alert.
 */
async function verifyAlertSystem() {
  console.log('--- Verifying Alert System ---');
  
  const testKarat = 24;
  const targetPrice = 9999; // High price to ensure trigger
  const mockToken = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]'; // Fake but valid format

  try {
    // 1. Create a dummy alert
    console.log(`Step 1: Inserting dummy alert for ${testKarat}K at ${targetPrice} QAR...`);
    const { data: alert, error: insertError } = await supabase
      .from('price_alerts')
      .insert({
        karat: testKarat,
        target_price: targetPrice,
        condition: 'below',
        expo_push_token: mockToken,
        is_active: true
      })
      .select()
      .single();

    if (insertError) throw insertError;
    console.log('✅ Dummy alert created.');

    // 2. Trigger check with a mock current price
    console.log('Step 2: Triggering alert check with simulated price of 250 QAR...');
    const mockLatestPrices = [
      { karat: 24, price: 250 }
    ];

    await checkAndSendAlerts(mockLatestPrices);
    console.log('✅ checkAndSendAlerts execution finished.');

    // 3. Cleanup
    console.log('Step 3: Cleaning up dummy alert...');
    const { error: deleteError } = await supabase
      .from('price_alerts')
      .delete()
      .eq('id', alert.id);

    if (deleteError) console.error('⚠️ Cleanup failed:', deleteError.message);
    else console.log('✅ Cleanup successful.');

    console.log('\n--- Verification Complete ---');
    console.log('Check the console logs above. You should see "🔔 Alert Triggered" and an "Error sending notification chunk" (due to fake token).');

  } catch (err) {
    console.error('❌ Verification failed:', err.message);
  }
}

verifyAlertSystem();
