// Script pour vérifier que le rôle superviseur fonctionne
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function verifySupervisorRole() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { 
    auth: { persistSession: false } 
  });

  try {
    console.log('🔍 Vérification du rôle superviseur...\n');
    
    // 1. Tester l'insertion d'un utilisateur superviseur
    console.log('1️⃣ Test d\'insertion d\'un utilisateur superviseur...');
    const testUser = {
      name: 'Test Superviseur',
      email: 'test-superviseur-' + Date.now() + '@example.com',
      password_hash: '$2b$10$test',
      role: 'superviseur',
      is_verified: true
    };
    
    const { data: insertResult, error: insertError } = await supabase
      .from('users')
      .insert([testUser])
      .select('id, name, role')
      .single();
    
    if (insertError) {
      console.log('❌ ÉCHEC: Impossible d\'insérer un utilisateur superviseur');
      console.log(`   Erreur: ${insertError.message}`);
      console.log('\n💡 La contrainte n\'a pas été corrigée. Suivez le guide GUIDE_CORRECTION_ROLE_SUPERVISEUR.md');
      return false;
    } else {
      console.log('✅ SUCCÈS: Utilisateur superviseur créé');
      console.log(`   ID: ${insertResult.id}, Nom: ${insertResult.name}, Rôle: ${insertResult.role}`);
      
      // Nettoyer l'utilisateur test
      await supabase.from('users').delete().eq('id', insertResult.id);
      console.log('🧹 Utilisateur test supprimé');
    }
    
    // 2. Vérifier le compte de COUTCHIKA AKPO BERNARD
    console.log('\n2️⃣ Vérification du compte COUTCHIKA AKPO BERNARD...');
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, email, role, phone, departement, commune, arrondissement, village, reference_lat, reference_lon, planning_start_date, planning_end_date')
      .eq('email', 'coutchikabernard26@gmail.com')
      .single();
    
    if (userError) {
      console.log('❌ Utilisateur non trouvé:', userError.message);
      return false;
    }
    
    console.log('✅ Utilisateur trouvé:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Nom: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Rôle: ${user.role}`);
    console.log(`   Téléphone: ${user.phone}`);
    console.log(`   Localisation: ${user.departement}, ${user.commune}, ${user.arrondissement}, ${user.village}`);
    console.log(`   Coordonnées: ${user.reference_lat}, ${user.reference_lon}`);
    console.log(`   Contrat: ${user.planning_start_date} au ${user.planning_end_date}`);
    
    // 3. Mettre à jour le rôle si nécessaire
    if (user.role !== 'superviseur') {
      console.log('\n3️⃣ Mise à jour du rôle vers "superviseur"...');
      const { error: updateError } = await supabase
        .from('users')
        .update({ role: 'superviseur' })
        .eq('id', user.id);
      
      if (updateError) {
        console.log('❌ Erreur lors de la mise à jour:', updateError.message);
        return false;
      } else {
        console.log('✅ Rôle mis à jour avec succès!');
      }
    } else {
      console.log('\n3️⃣ Le rôle est déjà "superviseur" ✅');
    }
    
    // 4. Vérification finale
    console.log('\n4️⃣ Vérification finale...');
    const { data: finalUser, error: finalError } = await supabase
      .from('users')
      .select('name, email, role')
      .eq('email', 'coutchikabernard26@gmail.com')
      .single();
    
    if (finalUser && finalUser.role === 'superviseur') {
      console.log('🎉 SUCCÈS COMPLET!');
      console.log(`   ${finalUser.name} a maintenant le rôle "${finalUser.role}"`);
      console.log('\n📋 Informations de connexion:');
      console.log(`   Email: ${finalUser.email}`);
      console.log(`   Mot de passe: 123456`);
      console.log(`   Rôle: ${finalUser.role}`);
      return true;
    } else {
      console.log('❌ Échec de la vérification finale');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Erreur générale:', error);
    return false;
  }
}

verifySupervisorRole().then(success => {
  if (success) {
    console.log('\n✅ Le rôle superviseur est maintenant fonctionnel!');
  } else {
    console.log('\n❌ Le rôle superviseur n\'est pas encore fonctionnel.');
    console.log('   Suivez le guide GUIDE_CORRECTION_ROLE_SUPERVISEUR.md');
  }
});
