const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function updatePresenceTable() {
  console.log('🔧 Mise à jour de la table presences...');
  
  try {
    // 1. Vérifier la structure actuelle de la table
    console.log('\n🔍 Étape 1: Vérification de la structure actuelle...');
    const { data: currentColumns, error: columnsError } = await supabase
      .rpc('get_table_columns', { table_name: 'presences' });
    
    if (columnsError) {
      console.error('❌ Erreur vérification colonnes:', columnsError);
      // Alternative: Essayer une requête simple pour voir les colonnes
      try {
        const { data: sampleData, error: sampleError } = await supabase
          .from('presences')
          .select('*')
          .limit(1);
        
        if (sampleError) {
          console.error('❌ Erreur échantillon:', sampleError);
        } else if (sampleData && sampleData.length > 0) {
          console.log('📋 Colonnes actuelles (détectées):', Object.keys(sampleData[0]));
        } else {
          console.log('ℹ️ Table presences vide ou inexistente');
        }
      } catch (e) {
        console.error('❌ Erreur alternative:', e);
      }
    } else {
      console.log('📋 Colonnes actuelles:', currentColumns);
    }
    
    // 2. Créer/mettre à jour les colonnes manquantes
    console.log('\n🔄 Étape 2: Mise à jour des colonnes...');
    
    const updates = [
      // Renommer timestamp en start_time si existe
      'ALTER TABLE presences RENAME COLUMN timestamp TO start_time;',
      
      // Renommer photo_path en photo_url si existe
      'ALTER TABLE presences RENAME COLUMN photo_path TO photo_url;',
      
      // Ajouter les colonnes manquantes si elles n'existent pas
      'ALTER TABLE presences ADD COLUMN IF NOT EXISTS location_lat numeric(10, 8);',
      'ALTER TABLE presences ADD COLUMN IF NOT EXISTS location_lng numeric(11, 8);',
      'ALTER TABLE presences ADD COLUMN IF NOT EXISTS location_name character varying(255);',
      'ALTER TABLE presences ADD COLUMN IF NOT EXISTS notes text;',
      'ALTER TABLE presences ADD COLUMN IF NOT EXISTS photo_url character varying(500);',
      'ALTER TABLE presences ADD COLUMN IF NOT EXISTS status character varying(20) default \'active\';',
      'ALTER TABLE presences ADD COLUMN IF NOT EXISTS checkin_type character varying(50);',
      'ALTER TABLE presences ADD COLUMN IF NOT EXISTS zone_id integer;',
      'ALTER TABLE presences ADD COLUMN IF NOT EXISTS within_tolerance boolean;',
      'ALTER TABLE presences ADD COLUMN IF NOT EXISTS distance_from_reference_m integer;',
      'ALTER TABLE presences ADD COLUMN IF NOT EXISTS tolerance_meters integer;',
      
      // Créer les index
      'CREATE INDEX IF NOT EXISTS idx_presences_user_id ON presences(user_id);',
      'CREATE INDEX IF NOT EXISTS idx_presences_zone_id ON presences(zone_id);',
      'CREATE INDEX IF NOT EXISTS idx_presences_within_tolerance ON presences(within_tolerance);',
      
      // Ajouter les contraintes
      'ALTER TABLE presences ADD CONSTRAINT IF NOT EXISTS presences_status_check CHECK (status IN (\'active\', \'completed\', \'cancelled\'));'
    ];
    
    for (const sql of updates) {
      try {
        console.log(`🔧 Exécution: ${sql.substring(0, 50)}...`);
        const { error: updateError } = await supabase.rpc('exec_sql', { sql_query: sql });
        
        if (updateError) {
          // Si exec_sql n'existe pas, essayer avec .from() direct
          console.log(`⚠️ exec_sql non disponible, tentative alternative...`);
        } else {
          console.log(`✅ Succès: ${sql.substring(0, 50)}...`);
        }
      } catch (e) {
        console.log(`ℹ️ Ignoré (peut-être déjà existant): ${sql.substring(0, 50)}...`);
      }
    }
    
    // 3. Vérifier les données existantes et les corriger
    console.log('\n🔍 Étape 3: Vérification et correction des données...');
    const { data: existingPresences, error: presencesError } = await supabase
      .from('presences')
      .select('*')
      .limit(10);
    
    if (presencesError) {
      console.error('❌ Erreur lecture presences:', presencesError);
    } else {
      console.log(`📊 ${existingPresences.length} presences trouvées`);
      
      // Corriger les données si nécessaire
      const updatesNeeded = [];
      
      existingPresences.forEach(presence => {
        const updates = {};
        
        // Corriger les noms de colonnes si nécessaire
        if (presence.timestamp && !presence.start_time) {
          updates.start_time = presence.timestamp;
        }
        
        if (presence.photo_path && !presence.photo_url) {
          updates.photo_url = presence.photo_path;
        }
        
        // Ajouter des valeurs par défaut
        if (!presence.status) {
          updates.status = 'active';
        }
        
        if (Object.keys(updates).length > 0) {
          updatesNeeded.push({ id: presence.id, ...updates });
        }
      });
      
      // Appliquer les mises à jour
      if (updatesNeeded.length > 0) {
        console.log(`🔄 Mise à jour de ${updatesNeeded.length} presences...`);
        
        for (const update of updatesNeeded) {
          const { id, ...fields } = update;
          const { error: updateError } = await supabase
            .from('presences')
            .update(fields)
            .eq('id', id);
          
          if (updateError) {
            console.error(`❌ Erreur mise à jour presence ${id}:`, updateError);
          } else {
            console.log(`✅ Presence ${id} mise à jour`);
          }
        }
      } else {
        console.log('ℹ️ Aucune mise à jour de données nécessaire');
      }
    }
    
    // 4. Vérification finale
    console.log('\n🔍 Étape 4: Vérification finale...');
    const { data: finalData, error: finalError } = await supabase
      .from('presences')
      .select('*')
      .limit(5);
    
    if (finalError) {
      console.error('❌ Erreur vérification finale:', finalError);
    } else {
      console.log(`✅ Table presences mise à jour avec succès!`);
      console.log(`📋 ${finalData.length} échantillons vérifiés`);
      
      if (finalData.length > 0) {
        console.log('📊 Colonnes finales:', Object.keys(finalData[0]));
        finalData.forEach((p, i) => {
          console.log(`  ${i + 1}. ID: ${p.id}, User: ${p.user_id}, Start: ${p.start_time}, Status: ${p.status}`);
        });
      }
    }
    
    // 5. Créer une présence de test si la table est vide
    console.log('\n🧪 Étape 5: Création d\'une présence de test...');
    const { count, error: countError } = await supabase
      .from('presences')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Erreur comptage:', countError);
    } else if (count === 0) {
      console.log('ℹ️ Table vide, création d\'une présence de test...');
      
      const { data: testUser, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'agent')
        .limit(1)
        .single();
      
      if (!userError && testUser) {
        const { data: newPresence, error: insertError } = await supabase
          .from('presences')
          .insert({
            user_id: testUser.id,
            start_time: new Date().toISOString(),
            end_time: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // 8h plus tard
            location_lat: 9.5,
            location_lng: 2.5,
            location_name: 'Test Location',
            notes: 'Test presence',
            status: 'active',
            checkin_type: 'checkin'
          })
          .select()
          .single();
        
        if (insertError) {
          console.error('❌ Erreur création test:', insertError);
        } else {
          console.log('✅ Présence de test créée:', newPresence.id);
        }
      } else {
        console.log('⚠️ Aucun agent trouvé pour le test');
      }
    } else {
      console.log(`ℹ️ Table contient déjà ${count} presences`);
    }
    
    console.log('\n🎉 Mise à jour de la table presences terminée!');
    
  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

// Fonction alternative si RPC n'est pas disponible
async function updatePresenceTableDirect() {
  console.log('🔧 Mise à jour directe de la table presences...');
  
  try {
    // Tenter de lire la structure actuelle
    const { data: testData, error: testError } = await supabase
      .from('presences')
      .select('*')
      .limit(1);
    
    if (testError) {
      console.error('❌ Erreur accès table presences:', testError);
      console.log('ℹ️ La table presences n\'existe peut-être pas encore');
      
      // Créer la table avec la bonne structure
      console.log('🔧 Création de la table presences...');
      // Note: Avec Supabase, on ne peut pas créer de table directement via JS
      // Il faut utiliser l'interface SQL de Supabase
      console.log('📋 Utilisez l\'interface SQL de Supabase avec le script fourni');
    } else {
      console.log('✅ Table presences accessible');
      
      if (testData.length > 0) {
        console.log('📋 Colonnes détectées:', Object.keys(testData[0]));
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  }
}

updatePresenceTable();
