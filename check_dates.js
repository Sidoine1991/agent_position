const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function checkDates() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const { data } = await supabase
    .from('checkin_validations')
    .select('id, created_at, agent_id')
    .limit(10);
  
  console.log('📅 Dates réelles des validations:');
  data.forEach(v => {
    const createdDate = new Date(v.created_at);
    const localDate = createdDate.toLocaleDateString('fr-FR');
    const utcDate = createdDate.toISOString().split('T')[0];
    console.log(`ID: ${v.id}, agent: ${v.agent_id}, created_at: ${v.created_at}, local: ${localDate}, UTC: ${utcDate}`);
  });
  
  console.log('\n🔍 Test de comparaison:');
  const testDate = '2025-11-18';
  const fromDate = new Date(testDate);
  const toDate = new Date(testDate + 'T23:59:59.999Z');
  
  console.log('From:', fromDate.toISOString());
  console.log('To:', toDate.toISOString());
  
  data.forEach(v => {
    const timestamp = new Date(v.created_at);
    const inRange = timestamp >= fromDate && timestamp <= toDate;
    console.log(`Validation ${v.id}: ${v.created_at} -> in range: ${inRange}`);
  });
}

checkDates();
