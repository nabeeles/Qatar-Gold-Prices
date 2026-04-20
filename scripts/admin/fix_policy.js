const { supabase } = require('./db');

async function fixProviderPolicy() {
  console.log('--- Fixing Provider RLS Policy ---');
  
  // Update the policy to allow authenticated users to read providers
  const { error } = await supabase.rpc('execute_sql', {
    sql_query: `
      drop policy if exists "No public/app access to providers" on providers;
      create policy "Authenticated users can read providers"
        on providers for select
        to authenticated
        using (true);
    `
  }).catch(async (err) => {
      // If RPC is not available, we can't do it this way.
      // I'll assume the user will run it in the SQL Editor.
      console.log('Please run this SQL in your Supabase SQL Editor:');
      console.log('drop policy if exists "No public/app access to providers" on providers;');
      console.log('create policy "Authenticated users can read providers" on providers for select to authenticated using (true);');
  });

  if (error) console.error('Error:', error.message);
}

fixProviderPolicy();
