#!/usr/bin/env node

/**
 * Script de synchronisation des colonnes de tolérance
 * 
 * Ce script synchronise la colonne `tolerance_meters` de la table `presences`
 * avec la colonne `tolerance_radius_meters` de la table `users`.
 * 
 * Usage: node scripts/sync_tolerance_meters.js
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

async function syncToleranceMeters() {
  console.log('🔄 Début de la synchronisation des colonnes de tolérance...');
  
  try {
    // 1. Récupérer tous les utilisateurs avec leur tolerance_radius_meters
    console.log('📊 Récupération des utilisateurs...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, first_name, last_name, tolerance_radius_meters')
      .not('tolerance_radius_meters', 'is', null);
    
    if (usersError) {
      throw new Error(`Erreur lors de la récupération des utilisateurs: ${usersError.message}`);
    }
    
    console.log(`✅ ${users.length} utilisateurs trouvés avec tolerance_radius_meters`);
    
    // 2. Créer une map des utilisateurs pour un accès rapide
    const usersMap = new Map();
    users.forEach(user => {
      usersMap.set(user.id, user);
    });
    
    // 3. Récupérer toutes les presences qui ont tolerance_meters null ou différent
    console.log('📊 Récupération des presences...');
    const { data: presences, error: presencesError } = await supabase
      .from('presences')
      .select('id, user_id, tolerance_meters, start_time')
      .not('user_id', 'is', null);
    
    if (presencesError) {
      throw new Error(`Erreur lors de la récupération des presences: ${presencesError.message}`);
    }
    
    console.log(`✅ ${presences.length} presences trouvées`);
    
    // 4. Identifier les presences à mettre à jour
    const presencesToUpdate = [];
    
    presences.forEach(presence => {
      const user = usersMap.get(presence.user_id);
      if (user && user.tolerance_radius_meters) {
        const currentTolerance = presence.tolerance_meters;
        const expectedTolerance = user.tolerance_radius_meters;
        
        if (currentTolerance !== expectedTolerance) {
          presencesToUpdate.push({
            id: presence.id,
            user_id: presence.user_id,
            current_tolerance: currentTolerance,
            expected_tolerance: expectedTolerance,
            user_name: user.name || `${user.first_name} ${user.last_name}`.trim()
          });
        }
      }
    });
    
    console.log(`📋 ${presencesToUpdate.length} presences à mettre à jour`);
    
    if (presencesToUpdate.length === 0) {
      console.log('✅ Aucune mise à jour nécessaire - toutes les presences sont déjà synchronisées');
      return;
    }
    
    // 5. Afficher un résumé des mises à jour
    console.log('\n📊 Résumé des mises à jour:');
    presencesToUpdate.slice(0, 10).forEach(p => {
      console.log(`  - ${p.user_name} (ID: ${p.user_id}): ${p.current_tolerance || 'NULL'} → ${p.expected_tolerance}`);
    });
    
    if (presencesToUpdate.length > 10) {
      console.log(`  ... et ${presencesToUpdate.length - 10} autres`);
    }
    
    // 6. Effectuer les mises à jour par batch
    console.log('\n🔄 Mise à jour des presences...');
    const batchSize = 100;
    let updatedCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < presencesToUpdate.length; i += batchSize) {
      const batch = presencesToUpdate.slice(i, i + batchSize);
      
      console.log(`  Traitement du batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(presencesToUpdate.length / batchSize)}...`);
      
      for (const presence of batch) {
        try {
          const { error: updateError } = await supabase
            .from('presences')
            .update({ 
              tolerance_meters: presence.expected_tolerance 
            })
            .eq('id', presence.id);
          
          if (updateError) {
            console.error(`❌ Erreur lors de la mise à jour de la présence ${presence.id}:`, updateError.message);
            errorCount++;
          } else {
            updatedCount++;
          }
        } catch (error) {
          console.error(`❌ Erreur lors de la mise à jour de la présence ${presence.id}:`, error.message);
          errorCount++;
        }
      }
      
      // Petite pause entre les batches pour éviter de surcharger la base
      if (i + batchSize < presencesToUpdate.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // 7. Résumé final
    console.log('\n📈 Résumé de la synchronisation:');
    console.log(`✅ ${updatedCount} presences mises à jour avec succès`);
    if (errorCount > 0) {
      console.log(`❌ ${errorCount} erreurs rencontrées`);
    }
    
    // 8. Vérification finale
    console.log('\n🔍 Vérification finale...');
    const { data: verification, error: verificationError } = await supabase
      .from('presences')
      .select('id, user_id, tolerance_meters, users!inner(tolerance_radius_meters)')
      .not('tolerance_meters', 'is', null)
      .not('users.tolerance_radius_meters', 'is', null);
    
    if (verificationError) {
      console.warn('⚠️ Impossible de vérifier les résultats:', verificationError.message);
    } else {
      const mismatched = verification.filter(p => p.tolerance_meters !== p.users.tolerance_radius_meters);
      if (mismatched.length === 0) {
        console.log('✅ Vérification réussie - toutes les presences sont synchronisées');
      } else {
        console.log(`⚠️ ${mismatched.length} presences ne sont pas encore synchronisées`);
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de la synchronisation:', error.message);
    process.exit(1);
  }
}

// Exécuter le script
if (require.main === module) {
  syncToleranceMeters()
    .then(() => {
      console.log('\n🎉 Synchronisation terminée avec succès!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Erreur fatale:', error.message);
      process.exit(1);
    });
}

module.exports = { syncToleranceMeters };
