const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTodayCheckins() {
  const today = new Date().toISOString().split('T')[0];
  console.log('Verification des checkins pour aujourd\'hui:', today);
  
  const { data, error } = await supabase
    .from('checkins')
    .select('*')
    .gte('created_at', today + 'T00:00:00.000Z')
    .lte('created_at', today + 'T23:59:59.999Z')
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (error) {
    console.error('Erreur:', error);
  } else {
    console.log('Checkins trouvés aujourd\'hui:', data.length);
    if (data.length > 0) {
      data.forEach((checkin, i) => {
        console.log('  ' + (i+1) + '. User:', checkin.user_id, 'à', new Date(checkin.created_at).toLocaleTimeString('fr-FR'));
        console.log('     Lat:', checkin.lat, 'Lon:', checkin.lon);
        console.log('     Type:', checkin.type, 'Note:', checkin.note || 'Aucune');
      });
    } else {
      console.log('❌ Aucun checkin trouvé pour aujourd\'hui');
    }
  }
}

checkTodayCheckins();
