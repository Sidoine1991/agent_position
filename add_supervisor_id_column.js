// Script pour ajouter la colonne supervisor_id à la table users
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function addSupervisorIdColumn() {
  console.log('🔧 Ajout de la colonne supervisor_id...\n');
  
  const supabase = createClient(
    process.env.SUPABASE_URL, 
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  try {
    // 1. Vérifier si la colonne existe déjà
    console.log('1️⃣ Vérification de l\'existence de la colonne...');
    const { data: testUsers, error: testError } = await supabase
      .from('users')
      .select('id, supervisor_id')
      .limit(1);

    if (!testError) {
      console.log('✅ La colonne supervisor_id existe déjà');
      return true;
    }

    if (testError && testError.message.includes('supervisor_id')) {
      console.log('⚠️ La colonne supervisor_id n\'existe pas encore');
    } else {
      console.log('❌ Erreur inattendue:', testError);
      return false;
    }

    // 2. Essayer d'ajouter la colonne via une requête SQL directe
    console.log('2️⃣ Tentative d\'ajout de la colonne...');
    
    // Utiliser l'API REST de Supabase pour exécuter du SQL
    const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY
      },
      body: JSON.stringify({ 
        sql: 'ALTER TABLE users ADD COLUMN supervisor_id INTEGER REFERENCES users(id)' 
      })
    });

    if (response.ok) {
      console.log('✅ Colonne supervisor_id ajoutée avec succès');
      
      // 3. Créer un index pour les performances
      console.log('3️⃣ Création de l\'index...');
      const indexResponse = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY
        },
        body: JSON.stringify({ 
          sql: 'CREATE INDEX IF NOT EXISTS idx_users_supervisor_id ON users(supervisor_id)' 
        })
      });

      if (indexResponse.ok) {
        console.log('✅ Index créé avec succès');
      } else {
        console.log('⚠️ Impossible de créer l\'index automatiquement');
      }

      return true;
    } else {
      const error = await response.text();
      console.log('❌ Erreur lors de l\'ajout de la colonne:', error);
      
      // 4. Alternative: utiliser une fonction SQL
      console.log('4️⃣ Tentative alternative avec une fonction SQL...');
      
      const functionSQL = `
        CREATE OR REPLACE FUNCTION add_supervisor_id_column()
        RETURNS void AS $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'supervisor_id'
          ) THEN
            ALTER TABLE users ADD COLUMN supervisor_id INTEGER REFERENCES users(id);
            CREATE INDEX IF NOT EXISTS idx_users_supervisor_id ON users(supervisor_id);
          END IF;
        END;
        $$ LANGUAGE plpgsql;
        
        SELECT add_supervisor_id_column();
        DROP FUNCTION add_supervisor_id_column();
      `;

      const funcResponse = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY
        },
        body: JSON.stringify({ sql: functionSQL })
      });

      if (funcResponse.ok) {
        console.log('✅ Colonne supervisor_id ajoutée via fonction SQL');
        return true;
      } else {
        const funcError = await funcResponse.text();
        console.log('❌ Erreur avec la fonction SQL:', funcError);
        return false;
      }
    }

  } catch (error) {
    console.error('❌ Erreur générale:', error);
    return false;
  }
}

// Exécuter le script
addSupervisorIdColumn().then(success => {
  if (success) {
    console.log('\n🎉 Colonne supervisor_id ajoutée avec succès!');
    console.log('🔄 Vous pouvez maintenant exécuter: node assign_supervisors.js');
  } else {
    console.log('\n❌ Impossible d\'ajouter la colonne automatiquement');
    console.log('📋 Veuillez exécuter manuellement dans Supabase SQL Editor:');
    console.log('   ALTER TABLE users ADD COLUMN supervisor_id INTEGER REFERENCES users(id);');
    console.log('   CREATE INDEX IF NOT EXISTS idx_users_supervisor_id ON users(supervisor_id);');
  }
}).catch(console.error);
