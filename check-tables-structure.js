const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const supabaseUrl = 'https://eoamsmtdspedumjmmeui.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvYW1zbXRkc3BlZHVtam1tZXVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwMjcyMzksImV4cCI6MjA3NDYwMzIzOX0.5F1uBbPfMYNlGgFJI20jexPf_XmPLiEOEtCTO_zZDcw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTableStructure() {
  console.log('🔍 Vérification de la structure des tables...\n');

  const tables = [
    { 
      name: 'checkins',
      requiredColumns: ['id', 'user_id', 'start_time', 'type', 'lat', 'lon']
    },
    { 
      name: 'presences',
      requiredColumns: ['id', 'user_id', 'start_time', 'status', 'location_lat', 'location_lng']
    },
    { 
      name: 'permissions',
      requiredColumns: ['id', 'agent_id', 'start_date', 'end_date', 'status']
    },
    { 
      name: 'users',
      requiredColumns: ['id', 'email', 'role', 'created_at']
    }
  ];

  for (const {name, requiredColumns} of tables) {
    try {
      // Essayer de récupérer un enregistrement pour voir la structure
      const { data, error } = await supabase
        .from(name)
        .select('*')
        .limit(1);

      if (error) throw error;
      
      if (!data || data.length === 0) {
        console.log(`ℹ️ Table ${name}: Aucune donnée pour vérifier la structure`);
        continue;
      }

      // Obtenir les colonnes existantes
      const existingColumns = Object.keys(data[0]);
      const missingColumns = requiredColumns.filter(col => 
        !existingColumns.includes(col)
      );

      // Afficher le résultat
      if (missingColumns.length > 0) {
        console.log(`⚠️  Table ${name}:`);
        console.log(`   Colonnes manquantes: ${missingColumns.join(', ')}`);
        console.log(`   Colonnes existantes: ${existingColumns.join(', ')}\n`);
      } else {
        console.log(`✅ Table ${name}: Structure OK`);
        console.log(`   Colonnes: ${existingColumns.join(', ')}\n`);
      }

    } catch (error) {
      console.error(`❌ Erreur avec la table ${name}:`, error.message);
    }
  }

  console.log('\n✅ Vérification terminée!');
}

// Vérifier les relations entre les tables
async function checkRelationships() {
  console.log('\n🔗 Vérification des relations entre les tables...\n');

  try {
    // Vérifier les utilisateurs sans check-ins
    const { data: usersWithoutCheckins } = await supabase
      .from('users')
      .select('id, email')
      .not('id', 'in', 
        supabase
          .from('checkins')
          .select('user_id')
      )
      .limit(5);

    if (usersWithoutCheckins && usersWithoutCheckins.length > 0) {
      console.log('ℹ️ Utilisateurs sans check-ins:');
      console.log(usersWithoutCheckins);
    }

    // Vérifier les permissions sans utilisateur associé
    const { data: orphanedPermissions } = await supabase
      .from('permissions')
      .select('id, agent_id')
      .not('agent_id', 'in', 
        supabase
          .from('users')
          .select('id')
      )
      .limit(5);

    if (orphanedPermissions && orphanedPermissions.length > 0) {
      console.log('\n⚠️  Permissions orphelines (sans utilisateur associé):');
      console.log(orphanedPermissions);
    }

  } catch (error) {
    console.error('Erreur lors de la vérification des relations:', error);
  }
}

// Exécuter les vérifications
async function main() {
  await checkTableStructure();
  await checkRelationships();
}

main();
