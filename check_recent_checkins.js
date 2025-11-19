const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRecentCheckins() {
  console.log('🔍 Checking recent checkins...');
  
  try {
    const { data: checkins, error } = await supabase
      .from('checkins')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('❌ Error fetching checkins:', error);
      return;
    }
    
    console.log(`✅ Found ${checkins.length} recent checkins:`);
    
    checkins.forEach((checkin, index) => {
      console.log(`\n📍 Checkin #${index + 1}:`);
      console.log(`  ID: ${checkin.id}`);
      console.log(`  User ID: ${checkin.user_id}`);
      console.log(`  Mission ID: ${checkin.mission_id || 'N/A'}`);
      console.log(`  Type: ${checkin.type || 'N/A'}`);
      console.log(`  Lat/Lon: ${checkin.lat}, ${checkin.lon}`);
      console.log(`  Start Time: ${checkin.start_time}`);
      console.log(`  Created At: ${checkin.created_at}`);
      console.log(`  Note: ${checkin.note || 'N/A'}`);
      console.log(`  Photo URL: ${checkin.photo_url || 'N/A'}`);
      console.log(`  Accuracy: ${checkin.accuracy || 'N/A'}m`);
    });
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkRecentCheckins();
