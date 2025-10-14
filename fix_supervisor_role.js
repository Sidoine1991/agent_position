// Script pour corriger la contrainte de rôle et autoriser "superviseur"
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function fixSupervisorRole() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { 
    auth: { persistSession: false } 
  });

  try {
    console.log('🔧 Correction de la contrainte de rôle pour autoriser "superviseur"...');
    
    // Méthode 1: Utiliser la fonction SQL directe si disponible
    const sqlQueries = [
      'ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;',
      "ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'superviseur', 'agent'));"
    ];
    
    for (const sql of sqlQueries) {
      try {
        console.log(`📝 Exécution: ${sql}`);
        const { data, error } = await supabase.rpc('exec_sql', { sql });
        
        if (error) {
          console.log(`⚠️ Erreur avec exec_sql: ${error.message}`);
          // Essayer une approche alternative
          break;
        } else {
          console.log('✅ Requête exécutée avec succès');
        }
      } catch (err) {
        console.log(`⚠️ exec_sql non disponible: ${err.message}`);
        break;
      }
    }
    
    // Méthode 2: Tester directement avec un insert
    console.log('\n🧪 Test direct avec insertion d\'un utilisateur superviseur...');
    
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
      console.log('❌ La contrainte n\'a pas été corrigée:');
      console.log(`   Erreur: ${insertError.message}`);
      console.log('\n💡 Solutions possibles:');
      console.log('   1. Exécuter le script SQL manuellement dans l\'interface Supabase');
      console.log('   2. Utiliser l\'interface d\'administration Supabase');
      console.log('   3. Contacter l\'administrateur de la base de données');
      
      console.log('\n📋 Script SQL à exécuter:');
      console.log('   ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;');
      console.log("   ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'superviseur', 'agent'));");
      
    } else {
      console.log('✅ Contrainte corrigée avec succès!');
      console.log(`   Utilisateur test créé: ${insertResult.name} (ID: ${insertResult.id})`);
      
      // Nettoyer l'utilisateur test
      await supabase.from('users').delete().eq('id', insertResult.id);
      console.log('🧹 Utilisateur test supprimé');
      
      // Maintenant, mettre à jour le compte de COUTCHIKA AKPO BERNARD
      console.log('\n🔄 Mise à jour du rôle de COUTCHIKA AKPO BERNARD...');
      const { error: updateError } = await supabase
        .from('users')
        .update({ role: 'superviseur' })
        .eq('email', 'coutchikabernard26@gmail.com');
      
      if (updateError) {
        console.log('❌ Erreur lors de la mise à jour:', updateError.message);
      } else {
        console.log('✅ Rôle mis à jour avec succès!');
        console.log('   COUTCHIKA AKPO BERNARD a maintenant le rôle "superviseur"');
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

fixSupervisorRole();
