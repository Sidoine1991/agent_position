const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkUserWithId1() {
  console.log('Verification de l\'utilisateur avec ID = 1...');
  
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', 1)
    .single();
    
  if (error) {
    console.error('Erreur:', error);
  } else {
    console.log('Utilisateur ID = 1:');
    console.log('  Nom:', data.name);
    console.log('  Email:', data.email);
    console.log('  Rôle:', data.role);
    console.log('  Téléphone:', data.phone);
    console.log('  Projet:', data.project_name);
  }
  
  // Vérifier combien d'utilisateurs existent
  const { count, error: countError } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true });
    
  if (countError) {
    console.error('Erreur count:', countError);
  } else {
    console.log('\nTotal utilisateurs:', count);
  }
}

checkUserWithId1();
