const { supabase } = require('./db');
const { Expo } = require('expo-server-sdk');

// Initialize the Expo SDK for mobile push orchestration
let expo = new Expo();

/**
 * Validates and dispatches market threshold notifications to registered user devices.
 * 
 * Orchestration Logic:
 * 1. Synchronizes with the `price_alerts` registry to retrieve all active notification requests.
 * 2. Market Comparison: Evaluates user-defined target prices against the latest synchronized market averages per karat.
 * 3. Threshold Detection: Supports 'below' (market depreciation) and 'above' (market appreciation) trigger conditions.
 * 4. PII Security: Enforces masking of device identifiers in execution logs.
 * 5. Dispatch: Utilizes the Expo Push service to deliver high-priority financial alerts in batched chunks.
 * 6. State Persistence: Transition triggered alerts to an 'inactive' state to maintain a premium, non-redundant user experience.
 * 
 * @async
 * @function checkAndSendAlerts
 * @param {Array<Object>} latestPrices - Validated list of latest market average rates (e.g., [{ karat: 24, price: 255 }]).
 * @description Orchestrates the end-to-end lifecycle of a gold price alert event.
 */
async function checkAndSendAlerts(latestPrices) {
  console.log('--- Commencing Market Threshold Validation ---');
  
  // 1. Retrieve the active notification registry
  const { data: alerts, error } = await supabase
    .from('price_alerts')
    .select('*')
    .eq('is_active', true);

  if (error) {
    console.error('[Alerts] Failed to synchronize notification registry:', error.message);
    return;
  }

  console.log(`[Alerts] Identified ${alerts.length} active thresholds for evaluation.`);

  const messages = [];
  for (const alert of alerts) {
    // Isolate the relevant market rate for the requested purity level
    const currentPriceObj = latestPrices.find(p => p.karat === alert.karat);
    if (!currentPriceObj) continue;

    const currentPrice = currentPriceObj.price;
    let triggered = false;

    // Evaluate market movement against user-defined threshold
    if (alert.condition === 'below' && currentPrice <= alert.target_price) triggered = true;
    if (alert.condition === 'above' && currentPrice >= alert.target_price) triggered = true;

    if (triggered) {
      console.log(`🔔 Market Threshold Reached [User: ${alert.user_id}]: ${alert.karat}K at ${currentPrice} (Target: ${alert.target_price})`);
      
      // Identity Verification: Ensure device token is valid before dispatch
      if (!Expo.isExpoPushToken(alert.expo_push_token)) {
        console.error(`[Security] Invalid device identifier detected: ${alert.expo_push_token.substring(0, 10)}... (Redacted)`);
        continue;
      }

      messages.push({
        to: alert.expo_push_token,
        sound: 'default',
        title: '💰 Gold Price Alert!',
        body: `${alert.karat}K Gold is now QAR ${currentPrice}. This matches your target of ${alert.target_price}!`,
        data: { karat: alert.karat, price: currentPrice },
      });

      // Operational Update: Mark threshold as processed to prevent redundant dispatch
      await supabase.from('price_alerts').update({ is_active: false }).eq('id', alert.id);
    }
  }

  if (messages.length > 0) {
    console.log(`[Alerts] Dispatching ${messages.length} high-priority notifications...`);
    let chunks = expo.chunkPushNotifications(messages);
    for (let chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
      } catch (error) {
        console.error('[Alerts] Critical failure during notification dispatch:', error);
      }
    }
  }
}

module.exports = { checkAndSendAlerts };
