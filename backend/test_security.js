require('dotenv').config({ path: require('path').resolve(__dirname, './.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

async function runSecurityTests() {
  console.log('--- Supabase Security & RLS Validation ---\n');

  if (!supabaseUrl || !supabaseAnonKey) {
      console.error('❌ ERROR: Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment.');
      console.log('   (Ensure these are set in your backend/.env file)');
      return;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // TEST 1: Unauthenticated Read
  console.log('Test 1: Attempting to read prices WITHOUT authentication...');
  try {
    const { data, error } = await supabase.from('gold_prices').select('*').limit(1);
    if (error) {
        console.log(`✅ BLOCKED: ${error.message}`);
    } else if (data && data.length === 0) {
        console.log('✅ BLOCKED: Returned 0 rows (RLS filtered).');
    } else {
        console.log('❌ FAILED: Successfully read data without authentication!');
    }
  } catch (err) {
    console.log(`✅ BLOCKED: ${err.message}`);
  }

  console.log('\n---');

  // TEST 2: App Simulation (Anonymous Sign-in)
  console.log('Test 2: Simulating App behavior (Anonymous Sign-in)...');
  try {
    const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
    
    if (authError) {
        console.error(`❌ Auth Failed: ${authError.message}`);
        console.log('   (Make sure "Anonymous Sign-ins" is enabled in Supabase Auth -> Providers)');
        return;
    }

    console.log('✅ Auth Success: Session established.');

    console.log('Attempting to read providers WITH Anonymous session...');
    const { data: providers, error: provError } = await supabase.from('providers').select('name').limit(5);
    if (provError) {
        console.error(`❌ Providers Read Failed: ${provError.message}`);
    } else {
        console.log(`✅ Success: Retrieved ${providers.length} providers!`);
        console.log('   Names:', providers.map(p => p.name).join(', '));
    }

    console.log('\nAttempting to read prices WITH Anonymous session...');
    const { data, error: readError } = await supabase.from('gold_prices').select('*').limit(5);

    if (readError) {
        console.error(`❌ Read Failed: ${readError.message}`);
    } else {
        console.log(`✅ Success: Retrieved ${data.length} price records!`);
        if (data.length > 0) {
            console.log('   Sample:', data[0]);
        }
    }
  } catch (err) {
    console.error(`❌ Unexpected Error: ${err.message}`);
  }
}

runSecurityTests();
