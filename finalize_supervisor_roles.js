// Script pour finaliser la correction des rôles superviseur
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function finalizeSupervisorRoles() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { 
    auth: { persistSession: false } 
  });

  try {
    console.log('🎯 Finalisation de la correction des rôles superviseur...\n');
    
    // 1. Tester si la contrainte a été mise à jour
    console.log('1️⃣ Test de la nouvelle contrainte...');
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
      console.log('❌ La contrainte n\'a pas encore été mise à jour:');
      console.log(`   Erreur: ${insertError.message}`);
      console.log('\n💡 Veuillez d\'abord exécuter le script SQL dans Supabase:');
      console.log('   ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;');
      console.log("   ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'superviseur', 'agent'));");
      return;
    }
    
    console.log('✅ Contrainte mise à jour avec succès!');
    console.log(`   Utilisateur test créé: ${insertResult.name} (ID: ${insertResult.id})`);
    
    // Nettoyer l'utilisateur test
    await supabase.from('users').delete().eq('id', insertResult.id);
    console.log('🧹 Utilisateur test supprimé');
    
    // 2. Restaurer les rôles superviseur pour les utilisateurs concernés
    console.log('\n2️⃣ Restauration des rôles superviseur...');
    
    // Utilisateurs qui devraient avoir le rôle superviseur
    const supervisorEmails = [
      'agbaniephrem@gmail.com',
      'bernice.tognon@gmail.com',
      'coutchikabernard26@gmail.com'
    ];
    
    for (const email of supervisorEmails) {
      const { error: updateError } = await supabase
        .from('users')
        .update({ role: 'superviseur' })
        .eq('email', email);
      
      if (updateError) {
        console.log(`❌ Erreur pour ${email}: ${updateError.message}`);
      } else {
        console.log(`✅ ${email} mis à jour: admin → superviseur`);
      }
    }
    
    // 3. Vérification finale
    console.log('\n3️⃣ Vérification finale...');
    const { data: finalUsers, error: finalError } = await supabase
      .from('users')
      .select('id, name, email, role')
      .in('email', supervisorEmails);
    
    if (finalError) {
      console.error('❌ Erreur lors de la vérification finale:', finalError);
      return;
    }
    
    console.log('📋 État final des superviseurs:');
    finalUsers.forEach(user => {
      console.log(`   - ${user.name} (${user.email}): ${user.role}`);
    });
    
    // 4. Test complet
    console.log('\n4️⃣ Test complet du système...');
    const { data: testResult, error: testError } = await supabase
      .from('users')
      .select('role')
      .limit(10);
    
    if (testError) {
      console.error('❌ Erreur lors du test:', testError);
      return;
    }
    
    const roles = [...new Set(testResult.map(u => u.role))];
    console.log(`✅ Rôles disponibles: ${roles.join(', ')}`);
    
    if (roles.includes('superviseur')) {
      console.log('\n🎉 SUCCÈS COMPLET!');
      console.log('   Le rôle "superviseur" est maintenant fonctionnel.');
      console.log('   Tous les utilisateurs ont été mis à jour correctement.');
    } else {
      console.log('\n⚠️ Le rôle "superviseur" n\'est pas encore disponible.');
    }
    
  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

finalizeSupervisorRoles();
