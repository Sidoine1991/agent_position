const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const SUPABASE_URL = 'https://eoamsmtdspedumjmmeui.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvYW1zbXRkc3BlZHVtam1tZXVpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTAyNzIzOSwiZXhwIjoyMDc0NjAzMjM5fQ.SrDG8nvNxALqUSqXw3tGWuv9hgLF-bSyUdNmxcoYm_Y';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkToleranceData() {
  console.log('🔍 Vérification des données de tolérance...');
  
  // Récupérer les données des utilisateurs
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, name, tolerance_radius_meters')
    .order('id');
    
  if (usersError) {
    console.error('Erreur users:', usersError);
    return;
  }
  
  console.log('👥 Utilisateurs avec tolerance_radius_meters:');
  users.forEach(user => {
    console.log(`  ID ${user.id}: ${user.name} - ${user.tolerance_radius_meters}m`);
  });
  
  // Récupérer quelques validations pour comparer
  const { data: validations, error: validationsError } = await supabase
    .from('presence_validations')
    .select('id, user_id, tolerance_meters, users!presence_validations_user_id_fkey(tolerance_radius_meters)')
    .limit(10);
    
  if (validationsError) {
    console.error('Erreur validations:', validationsError);
    return;
  }
  
  console.log('\n📊 Validations avec tolerance_meters:');
  validations.forEach(val => {
    const userTolerance = val.users?.tolerance_radius_meters;
    const validationTolerance = val.tolerance_meters;
    const match = userTolerance === validationTolerance ? '✅' : '❌';
    console.log(`  ${match} Validation ${val.id} - User ${val.user_id}: ${validationTolerance}m (devrait être ${userTolerance}m)`);
  });
  
  // Compter les incohérences
  const mismatches = validations.filter(val => {
    const userTolerance = val.users?.tolerance_radius_meters;
    const validationTolerance = val.tolerance_meters;
    return userTolerance !== validationTolerance;
  });
  
  console.log(`\n📈 Résumé: ${mismatches.length}/${validations.length} validations ont des valeurs de tolérance incorrectes`);
}

checkToleranceData().catch(console.error);
