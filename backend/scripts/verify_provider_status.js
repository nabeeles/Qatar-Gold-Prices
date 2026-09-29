const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { supabase } = require('../scraper/utils/db');

async function checkStatus() {
  const { data, error } = await supabase
    .from('providers')
    .select('id, name, is_active, url')
    .eq('name', 'Shine Jewelers')
    .single();

  if (error) {
    console.error('Error fetching Shine:', error.message);
    process.exit(1);
  }

  console.log('Shine Jewelers status:', data);
  if (!data.is_active) {
    console.log('✅ Shine Jewelers is deactivated.');
    process.exit(0);
  } else {
    console.log('❌ Shine Jewelers is still active.');
    process.exit(2);
  }
}

checkStatus();
