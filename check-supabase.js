const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuration Supabase via variables d'environnement
const supabaseUrl = process.env.SUPABASE_URL;
// Pour une vérification complète (y compris tables système), on utilise la clé service role si disponible
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL ou clé Supabase manquante dans le fichier .env');
  process.exit(1);
}

// Initialisation du client Supabase
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  }
});

// Fonction pour vérifier la connexion et récupérer des données
async function checkSupabaseConnection() {
  console.log('🔍 Vérification de la connexion à Supabase...');
  
  try {
    // 1. Vérifier la connexion de base
    console.log('🔄 Test de connexion...');
    const { data, error } = await supabase
      .from('users')
      .select('id, email')
      .limit(1);
    
    if (error) {
      console.error('❌ Erreur de connexion à Supabase:', error.message);
      return;
    }
    
    console.log('✅ Connecté à Supabase avec succès!');
    
    // 2. Récupérer des données de test
    console.log('\n📊 Récupération des données de test...');
    
    // a. Compter les enregistrements dans chaque table
    const tables = ['checkins', 'presences', 'permissions', 'users'];
    
    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        if (error) {
          console.log(`ℹ️ ${table}: Erreur - ${error.message}`);
        } else {
          console.log(`📦 ${table}: ${count} enregistrements trouvés`);
        }
      } catch (err) {
        console.error(`❌ Erreur avec la table ${table}:`, err.message);
      }
    }
    
    // 3. Vérifier la structure des tables
    console.log('\n🔍 Vérification de la structure des tables...');
    const tableChecks = [
      { 
        name: 'checkins', 
        requiredColumns: ['id', 'user_id', 'start_time', 'type'] 
      },
      { 
        name: 'presences', 
        requiredColumns: ['id', 'user_id', 'start_time', 'status'] 
      },
      { 
        name: 'permissions', 
        requiredColumns: ['id', 'agent_id', 'start_date', 'status'] 
      }
    ];
    
    for (const {name, requiredColumns} of tableChecks) {
      try {
        const { data: columns, error } = await supabase
          .from('information_schema.columns')
          .select('column_name')
          .eq('table_name', name);
        
        if (error) throw error;
        
        if (!columns || columns.length === 0) {
          console.log(`❌ Table ${name} non trouvée dans la base de données`);
          continue;
        }
        
        const existingColumns = columns.map(c => c.column_name);
        const missingColumns = requiredColumns.filter(col => 
          !existingColumns.includes(col)
        );
        
        if (missingColumns.length > 0) {
          console.log(`⚠️  Table ${name}: Colonnes manquantes - ${missingColumns.join(', ')}`);
        } else {
          console.log(`✅ Table ${name}: Structure OK`);
        }
      } catch (err) {
        console.error(`❌ Erreur lors de la vérification de la table ${name}:`, err.message);
      }
    }
    
    console.log('\n✅ Vérification terminée avec succès!');
    
  } catch (error) {
    console.error('❌ Erreur critique:', error);
  }
}

// Exécuter la vérification
checkSupabaseConnection();
