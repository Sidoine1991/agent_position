#!/usr/bin/env node

/**
 * Script de migration vers la table presence_validations
 * 
 * Ce script migre les données existantes des tables presences et checkin_validations
 * vers la nouvelle table centralisée presence_validations.
 * 
 * Usage: node scripts/migrate_to_validation_table.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables d\'environnement SUPABASE_URL et SUPABASE_ANON_KEY requises');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateToValidationTable() {
  console.log('🔄 Début de la migration vers la table presence_validations...');
  
  try {
    // 1. Vérifier que la table presence_validations existe
    console.log('🔍 Vérification de la table presence_validations...');
    const { data: tableCheck, error: tableError } = await supabase
      .from('presence_validations')
      .select('id')
      .limit(1);
    
    if (tableError) {
      console.error('❌ Table presence_validations non trouvée. Exécutez d\'abord database/create_validation_table.sql');
      process.exit(1);
    }
    
    console.log('✅ Table presence_validations trouvée');
    
    // 2. Récupérer les presences existantes avec leurs informations de validation
    console.log('📊 Récupération des presences existantes...');
    const { data: presences, error: presencesError } = await supabase
      .from('presences')
      .select(`
        id,
        user_id,
        start_time,
        end_time,
        location_lat,
        location_lng,
        location_name,
        notes,
        photo_url,
        status,
        checkin_type,
        within_tolerance,
        distance_from_reference_m,
        tolerance_meters,
        created_at,
        users!inner(
          id,
          reference_lat,
          reference_lon,
          tolerance_radius_meters
        )
      `)
      .not('user_id', 'is', null)
      .order('start_time', { ascending: false });
    
    if (presencesError) {
      throw new Error(`Erreur lors de la récupération des presences: ${presencesError.message}`);
    }
    
    console.log(`✅ ${presences.length} presences trouvées`);
    
    if (presences.length === 0) {
      console.log('ℹ️ Aucune présence à migrer');
      return;
    }
    
    // 3. Récupérer les validations existantes (si elles existent)
    console.log('📊 Récupération des validations existantes...');
    let existingValidations = [];
    try {
      const { data: validations, error: validationsError } = await supabase
        .from('checkin_validations')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!validationsError && validations) {
        existingValidations = validations;
        console.log(`✅ ${validations.length} validations existantes trouvées`);
      }
    } catch (error) {
      console.log('ℹ️ Table checkin_validations non trouvée ou vide');
    }
    
    // 4. Créer une map des validations existantes par user_id + timestamp
    const validationsMap = new Map();
    existingValidations.forEach(validation => {
      const key = `${validation.user_id}_${new Date(validation.created_at).toISOString().split('T')[0]}`;
      validationsMap.set(key, validation);
    });
    
    // 5. Préparer les données pour la migration
    console.log('🔄 Préparation des données de migration...');
    const validationRecords = [];
    let skippedCount = 0;
    
    presences.forEach(presence => {
      const user = presence.users;
      if (!user) {
        console.warn(`⚠️ Présence ${presence.id} sans utilisateur associé, ignorée`);
        return;
      }
      
      // Déterminer le statut de validation
      let validationStatus = 'pending';
      let checkinType = 'manual'; // Valeur par défaut
      
      // Normaliser checkin_type selon les contraintes de la table
      if (presence.checkin_type) {
        const type = String(presence.checkin_type).toLowerCase().trim();
        if (['manual', 'automatic', 'admin_override'].includes(type)) {
          checkinType = type;
        } else if (type === 'validated' || type === 'rejected') {
          // Si checkin_type contient le statut, l'utiliser pour validation_status
          validationStatus = type;
          checkinType = 'manual';
        } else {
          checkinType = 'manual'; // Valeur par défaut pour les types non reconnus
        }
      }
      
      // Déterminer le statut de validation
      if (presence.checkin_type === 'validated') {
        validationStatus = 'validated';
      } else if (presence.checkin_type === 'rejected') {
        validationStatus = 'rejected';
      } else if (presence.within_tolerance === true) {
        validationStatus = 'validated';
      } else if (presence.within_tolerance === false) {
        validationStatus = 'rejected';
      }
      
      // Vérifier si une validation existe déjà pour cette présence
      const existingKey = `${presence.user_id}_${new Date(presence.start_time).toISOString().split('T')[0]}`;
      const existingValidation = validationsMap.get(existingKey);
      
      if (existingValidation) {
        console.log(`ℹ️ Validation existante trouvée pour la présence ${presence.id}, utilisation des données existantes`);
        validationStatus = existingValidation.valid ? 'validated' : 'rejected';
        checkinType = existingValidation.checkin_type || 'manual';
      }
      
      // Créer l'enregistrement de validation
      const validationRecord = {
        user_id: presence.user_id,
        presence_id: presence.id,
        validation_status: validationStatus,
        checkin_type: checkinType,
        checkin_lat: presence.location_lat || 0,
        checkin_lng: presence.location_lng || 0,
        checkin_location_name: presence.location_name,
        reference_lat: user.reference_lat,
        reference_lng: user.reference_lon,
        distance_from_reference_m: presence.distance_from_reference_m,
        tolerance_meters: presence.tolerance_meters || user.tolerance_radius_meters || 500,
        within_tolerance: presence.within_tolerance || false,
        validation_reason: presence.notes,
        validation_notes: existingValidation?.notes || presence.notes,
        validation_method: 'gps',
        photo_url: presence.photo_url,
        checkin_timestamp: presence.start_time,
        validation_timestamp: presence.created_at,
        device_info: {
          source: 'migration',
          original_presence_id: presence.id
        }
      };
      
      validationRecords.push(validationRecord);
    });
    
    console.log(`📋 ${validationRecords.length} enregistrements de validation préparés`);
    console.log(`⏭️ ${skippedCount} enregistrements ignorés`);
    
    if (validationRecords.length === 0) {
      console.log('ℹ️ Aucun enregistrement à migrer');
      return;
    }
    
    // 6. Insérer les données par batch
    console.log('🔄 Insertion des données dans presence_validations...');
    const batchSize = 50;
    let insertedCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < validationRecords.length; i += batchSize) {
      const batch = validationRecords.slice(i, i + batchSize);
      
      console.log(`  Traitement du batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(validationRecords.length / batchSize)}...`);
      
      try {
        const { data, error } = await supabase
          .from('presence_validations')
          .insert(batch)
          .select('id');
        
        if (error) {
          console.error(`❌ Erreur lors de l'insertion du batch:`, error.message);
          errorCount += batch.length;
        } else {
          insertedCount += data.length;
          console.log(`  ✅ ${data.length} enregistrements insérés`);
        }
      } catch (error) {
        console.error(`❌ Erreur lors de l'insertion du batch:`, error.message);
        errorCount += batch.length;
      }
      
      // Petite pause entre les batches
      if (i + batchSize < validationRecords.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    // 7. Résumé final
    console.log('\n📈 Résumé de la migration:');
    console.log(`✅ ${insertedCount} validations migrées avec succès`);
    if (errorCount > 0) {
      console.log(`❌ ${errorCount} erreurs rencontrées`);
    }
    
    // 8. Vérification finale
    console.log('\n🔍 Vérification finale...');
    const { data: finalCheck, error: finalError } = await supabase
      .from('presence_validations')
      .select('id, user_id, validation_status, checkin_type')
      .limit(10);
    
    if (finalError) {
      console.warn('⚠️ Impossible de vérifier les résultats:', finalError.message);
    } else {
      console.log(`✅ ${finalCheck.length} enregistrements trouvés dans presence_validations`);
      console.log('📊 Exemples d\'enregistrements:');
      finalCheck.slice(0, 3).forEach(record => {
        console.log(`  - ID: ${record.id}, User: ${record.user_id}, Status: ${record.validation_status}, Type: ${record.checkin_type}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error.message);
    process.exit(1);
  }
}

// Exécuter le script
if (require.main === module) {
  migrateToValidationTable()
    .then(() => {
      console.log('\n🎉 Migration terminée avec succès!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Erreur fatale:', error.message);
      process.exit(1);
    });
}

module.exports = { migrateToValidationTable };
