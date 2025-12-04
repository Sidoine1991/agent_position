// Script pour mettre à jour le rôle d'un utilisateur vers superadmin
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variables d\'environnement manquantes: SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function updateUserToSuperadmin() {
  const email = 'kolasidoine@gmail.com';
  
  try {
    console.log(`🔄 Mise à jour du rôle de ${email} vers superadmin...\n`);
    
    // 1. Vérifier si l'utilisateur existe
    console.log('1️⃣ Vérification de l\'utilisateur...');
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, email, role')
      .eq('email', email)
      .single();
    
    if (userError) {
      console.error('❌ Utilisateur non trouvé:', userError.message);
      return false;
    }
    
    console.log('✅ Utilisateur trouvé:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Nom: ${user.name || 'N/A'}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Rôle actuel: ${user.role}\n`);
    
    // 2. Vérifier si le rôle est déjà superadmin
    if (user.role === 'superadmin') {
      console.log('✅ Le rôle est déjà "superadmin" - Aucune modification nécessaire');
      return true;
    }
    
    // 3. Essayer de mettre à jour directement
    console.log('2️⃣ Tentative de mise à jour du rôle vers "superadmin"...');
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({ role: 'superadmin' })
      .eq('id', user.id)
      .select('id, name, email, role')
      .single();
    
    if (updateError) {
      console.log('⚠️ Erreur lors de la mise à jour:', updateError.message);
      
      // Si l'erreur est due à une contrainte CHECK
      if (updateError.message && updateError.message.includes('check constraint')) {
        console.log('\n💡 La contrainte CHECK de la base de données bloque "superadmin".');
        console.log('   Il faut d\'abord modifier la contrainte.\n');
        
        console.log('📋 INSTRUCTIONS:');
        console.log('─'.repeat(70));
        console.log('1. Allez sur https://supabase.com');
        console.log('2. Ouvrez votre projet');
        console.log('3. Allez dans "SQL Editor"');
        console.log('4. Exécutez ces requêtes SQL:\n');
        console.log('   ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;');
        console.log("   ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'superadmin', 'superviseur', 'agent'));\n");
        console.log('5. Puis réexécutez ce script: node update_user_to_superadmin.js');
        console.log('─'.repeat(70));
        
        return false;
      } else {
        console.error('❌ Erreur inattendue:', updateError.message);
        return false;
      }
    }
    
    console.log('✅ Rôle mis à jour avec succès!');
    console.log(`   ${updatedUser.name || updatedUser.email} a maintenant le rôle "superadmin"\n`);
    
    // 4. Vérification finale
    console.log('3️⃣ Vérification finale...');
    const { data: finalUser, error: finalError } = await supabase
      .from('users')
      .select('id, name, email, role')
      .eq('email', email)
      .single();
    
    if (finalError) {
      console.error('❌ Erreur lors de la vérification finale:', finalError.message);
      return false;
    }
    
    if (finalUser && finalUser.role === 'superadmin') {
      console.log('✅ Vérification réussie!');
      console.log(`   Email: ${finalUser.email}`);
      console.log(`   Rôle: ${finalUser.role}`);
      return true;
    } else {
      console.log('⚠️ Le rôle n\'a pas été mis à jour correctement');
      console.log(`   Rôle actuel: ${finalUser.role}`);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Erreur générale:', error);
    return false;
  }
}

// Exécuter le script
updateUserToSuperadmin()
  .then(success => {
    if (success) {
      console.log('\n🎉 Script terminé avec succès!');
      console.log('   L\'utilisateur kolasidoine@gmail.com a maintenant le rôle "superadmin"');
      process.exit(0);
    } else {
      console.log('\n❌ Script terminé avec des erreurs');
      console.log('   Suivez les instructions ci-dessus pour modifier la contrainte CHECK');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });
