const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixRLS() {
  console.log('--- Updating RLS Policies ---');
  
  // Update providers policy to allow reading name and is_active for app users
  // We'll do this via raw SQL if possible, or just describe what to do.
  // Since we can't run raw DDL via the client without an RPC, 
  // I will assume the user has the 'execute_sql' RPC or can run this in dashboard.
  
  console.log('Please run the following SQL in your Supabase Dashboard to allow the app to filter by active providers:');
  console.log(`
    DROP POLICY IF EXISTS "No public/app access to providers" ON providers;
    CREATE POLICY "Allow authenticated users to read provider info" 
      ON providers FOR SELECT 
      TO authenticated 
      USING (true);
  `);
}

fixRLS();
