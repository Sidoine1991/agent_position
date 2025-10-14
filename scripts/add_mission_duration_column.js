const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey);

async function addMissionDurationColumn() {
  try {
    console.log('🔧 Ajout de la colonne mission_duration à la table checkins...');
    
    // Vérifier d'abord si la colonne existe déjà
    const { data: columns, error: columnsError } = await supabaseClient
      .from('checkins')
      .select('*')
      .limit(1);
    
    if (columnsError) {
      console.error('❌ Erreur lors de la vérification de la table:', columnsError);
      return;
    }
    
    console.log('📋 Colonnes actuelles de la table checkins:', Object.keys(columns[0] || {}));
    
    if (columns[0] && 'mission_duration' in columns[0]) {
      console.log('✅ La colonne mission_duration existe déjà');
      return;
    }
    
    // Note: Supabase ne permet pas d'ajouter des colonnes via l'API REST
    // Il faut le faire via l'interface Supabase ou SQL direct
    console.log('⚠️ Impossible d\'ajouter la colonne via l\'API REST');
    console.log('📝 Veuillez exécuter cette commande SQL dans l\'interface Supabase:');
    console.log('');
    console.log('ALTER TABLE checkins ADD COLUMN mission_duration INTEGER DEFAULT NULL;');
    console.log('COMMENT ON COLUMN checkins.mission_duration IS \'Durée de la mission en minutes (calculée entre début et fin de mission)\';');
    console.log('');
    
  } catch (err) {
    console.error('❌ Erreur inattendue:', err);
  }
}

addMissionDurationColumn();
