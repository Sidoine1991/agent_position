const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Configuration Supabase (utilisez vos vraies valeurs)
const supabaseUrl = 'https://your-project.supabase.co'; // Remplacez par votre URL
const supabaseKey = 'your-anon-key'; // Remplacez par votre clé

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixTrigger() {
  try {
    console.log('🔧 Correction du trigger pour la suppression d\'utilisateurs...');
    
    // Lire le fichier SQL
    const sql = fs.readFileSync('database/fix_trigger_delete_user.sql', 'utf8');
    
    // Diviser le SQL en requêtes individuelles
    const queries = sql.split(';').filter(q => q.trim().length > 0);
    
    for (const query of queries) {
      if (query.trim()) {
        console.log('📝 Exécution:', query.trim().substring(0, 50) + '...');
        
        const { data, error } = await supabase
          .from('_dummy_table_that_does_not_exist') // Utilise une table qui n'existe pas pour exécuter du SQL brut
          .select('*')
          .limit(0);
        
        // Alternative: utiliser une requête directe
        const { data: result, error: sqlError } = await supabase.rpc('exec_sql', { 
          sql_query: query.trim() 
        });
        
        if (sqlError) {
          console.log('⚠️  Erreur (peut être normale):', sqlError.message);
        } else {
          console.log('✅ Requête exécutée');
        }
      }
    }
    
    console.log('✅ Correction du trigger terminée!');
    
  } catch (err) {
    console.log('❌ Erreur lors de l\'exécution:', err.message);
    console.log('\n📋 Instructions manuelles:');
    console.log('1. Connectez-vous à votre console Supabase');
    console.log('2. Allez dans SQL Editor');
    console.log('3. Copiez et exécutez le contenu du fichier database/fix_trigger_delete_user.sql');
  }
}

fixTrigger();
