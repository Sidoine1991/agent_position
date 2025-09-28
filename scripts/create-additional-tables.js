require('dotenv').config({ path: './.env' });
require('dotenv').config({ path: './web/.env', override: true });

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error('❌ Erreur: SUPABASE_URL ou SUPABASE_SERVICE_ROLE non définis.');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

async function createAdditionalTables() {
  console.log('🚀 Création des tables supplémentaires...');

  try {
    // Lire le fichier SQL
    const fs = require('fs');
    const path = require('path');
    const sqlContent = fs.readFileSync(path.join(__dirname, '../supabase/additional-tables.sql'), 'utf8');
    
    // Diviser le contenu en requêtes individuelles
    const queries = sqlContent
      .split(';')
      .map(q => q.trim())
      .filter(q => q.length > 0 && !q.startsWith('--'));

    console.log(`📝 Exécution de ${queries.length} requêtes SQL...`);

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      if (query.trim()) {
        try {
          console.log(`\n${i + 1}/${queries.length} Exécution: ${query.substring(0, 100)}...`);
          const { error } = await supabaseAdmin.rpc('exec_sql', { sql: query });
          if (error) {
            // Certaines erreurs sont normales (tables existantes, etc.)
            if (error.message.includes('already exists') || 
                error.message.includes('duplicate key') ||
                error.message.includes('relation already exists')) {
              console.log(`⚠️ ${error.message} (ignoré)`);
            } else {
              throw error;
            }
          } else {
            console.log(`✅ Requête ${i + 1} exécutée`);
          }
        } catch (err) {
          console.log(`⚠️ Erreur requête ${i + 1}: ${err.message} (continuons...)`);
        }
      }
    }

    console.log('\n🎉 Tables supplémentaires créées!');
    console.log('\n📋 Prochaines étapes:');
    console.log('1. Vérifiez les tables dans Supabase Dashboard');
    console.log('2. Exécutez l\'insertion des données initiales');

  } catch (error) {
    console.error('❌ Erreur lors de la création des tables:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

createAdditionalTables();
