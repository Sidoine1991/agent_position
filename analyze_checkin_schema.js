const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function analyzeCheckinSchema() {
  console.log('🔍 Analyse du schéma de la table checkins...');
  
  try {
    // 1. Obtenir la structure actuelle de la table
    console.log('\n📊 Étape 1: Structure actuelle de la table checkins...');
    
    // Pour analyser, on va essayer d'insérer un checkin avec différents champs pour voir ce qui passe
    const testCheckin = {
      user_id: 56, // Utilisateur valide
      mission_id: null,
      lat: 9.7133572,
      lon: 1.3811426,
      start_time: new Date().toISOString(),
      end_time: null,
      type: 'checkin',
      note: 'Test schéma',
      photo_url: null,
      accuracy: 10.5,
      battery_level: 85,
      network_type: 'wifi',
      device_info: { os: 'Android', version: '10' },
      created_at: new Date().toISOString()
    };
    
    console.log('📋 Données de test:', JSON.stringify(testCheckin, null, 2));
    
    // 2. Comparer avec le schéma attendu
    console.log('\n🔍 Étape 2: Comparaison des schémas...');
    
    const schemaSupabase = {
      id: 'serial not null',
      user_id: 'integer not null',
      mission_id: 'integer null',
      lat: 'numeric(10, 8) not null',
      lon: 'numeric(11, 8) not null',
      start_time: 'timestamp without time zone not null default CURRENT_TIMESTAMP',
      end_time: 'timestamp without time zone null',
      type: 'character varying(50) null default checkin',
      note: 'text null',
      photo_url: 'character varying(500) null',
      accuracy: 'numeric(8, 2) null',
      battery_level: 'integer null',
      network_type: 'character varying(20) null',
      device_info: 'jsonb null',
      created_at: 'timestamp without time zone null default CURRENT_TIMESTAMP'
    };
    
    // 3. Vérifier les données existantes pour voir les champs utilisés
    console.log('\n📊 Étape 3: Analyse des données existantes...');
    
    const { data: existingCheckins, error: existingError } = await supabase
      .from('checkins')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(3);
    
    if (existingError) {
      console.error('❌ Erreur récupération checkins:', existingError);
      return;
    }
    
    console.log(`✅ ${existingCheckins?.length || 0} checkins analysés`);
    
    if (existingCheckins && existingCheckins.length > 0) {
      console.log('\n📋 Champs trouvés dans les données:');
      const allFields = new Set();
      
      existingCheckins.forEach(checkin => {
        Object.keys(checkin).forEach(key => allFields.add(key));
      });
      
      console.log('🔧 Champs présents:', Array.from(allFields).sort());
      
      // Afficher un exemple
      console.log('\n📋 Exemple de checkin existant:');
      console.log(JSON.stringify(existingCheckins[0], null, 2));
    }
    
    // 4. Identifier les incohérences
    console.log('\n🚨 Étape 4: Identification des incohérences...');
    
    console.log('\n❌ Problèmes identifiés:');
    console.log('1. Le code utilise "timestamp" au lieu de "start_time"');
    console.log('2. Le code utilise "accuracy_m" au lieu de "accuracy"');
    console.log('3. Le code utilise "notes" au lieu de "note"');
    console.log('4. Le code utilise "commune/arrondissement/village" qui ne sont pas dans le schéma');
    console.log('5. Le schéma a des champs non utilisés: battery_level, network_type, device_info');
    
    // 5. Vérifier l'endpoint /api/checkins
    console.log('\n🔍 Étape 5: Vérification de l\'endpoint...');
    
    const fs = require('fs');
    const serverPath = require('path').join(__dirname, 'server.js');
    const serverContent = fs.readFileSync(serverPath, 'utf8');
    
    // Extraire les champs utilisés dans l'endpoint
    const endpointMatch = serverContent.match(/app\.post\('\/api\/checkins'[\s\S]*?\}\);/);
    
    if (endpointMatch) {
      const endpointCode = endpointMatch[0];
      console.log('\n📋 Champs utilisés dans l\'endpoint:');
      
      const fields = [
        'lat', 'lon', 'type', 'accuracy_m', 'commune', 
        'arrondissement', 'village', 'notes', 'timestamp'
      ];
      
      fields.forEach(field => {
        const isUsed = endpointCode.includes(field);
        console.log(`  ${isUsed ? '✅' : '❌'} ${field}`);
      });
    }
    
    console.log('\n🎉 Analyse terminée!');
    
  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

analyzeCheckinSchema();
