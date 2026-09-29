const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { supabase } = require('../scraper/utils/db');

async function deactivateShine() {
  console.log('--- Deactivating Shine Jewelers from Provider Registry ---');

  const { data, error } = await supabase
    .from('providers')
    .update({ is_active: false })
    .eq('name', 'Shine Jewelers')
    .select('id, name, is_active');

  if (error) {
    console.error('❌ Failed to deactivate Shine Jewelers:', error.message);
    process.exit(1);
  }

  console.log('✅ Successfully deactivated provider:', data);
}

deactivateShine();
