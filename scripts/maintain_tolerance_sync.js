const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const SUPABASE_URL = 'https://eoamsmtdspedumjmmeui.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvYW1zbXRkc3BlZHVtam1tZXVpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTAyNzIzOSwiZXhwIjoyMDc0NjAzMjM5fQ.SrDG8nvNxALqUSqXw3tGWuv9hgLF-bSyUdNmxcoYm_Y';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function maintainToleranceSync() {
  console.log('🔧 Maintenance de la synchronisation des valeurs de tolérance...');
  
  try {
    // Récupérer tous les utilisateurs avec leur tolerance_radius_meters
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, tolerance_radius_meters')
      .not('tolerance_radius_meters', 'is', null);
      
    if (usersError) {
      console.error('❌ Erreur lors de la récupération des utilisateurs:', usersError);
      return;
    }
    
    console.log(`👥 ${users.length} utilisateurs trouvés`);
    
    // Créer un map pour un accès rapide
    const userToleranceMap = new Map();
    users.forEach(user => {
      userToleranceMap.set(user.id, user.tolerance_radius_meters);
    });
    
    // Récupérer les validations récentes (dernières 24h) qui pourraient avoir des valeurs incorrectes
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const { data: recentValidations, error: validationsError } = await supabase
      .from('presence_validations')
      .select('id, user_id, tolerance_meters, created_at')
      .gte('created_at', yesterday.toISOString())
      .not('user_id', 'is', null);
      
    if (validationsError) {
      console.error('❌ Erreur lors de la récupération des validations récentes:', validationsError);
      return;
    }
    
    console.log(`📊 ${recentValidations.length} validations récentes trouvées`);
    
    // Identifier les validations à corriger
    const validationsToUpdate = [];
    
    recentValidations.forEach(validation => {
      const correctTolerance = userToleranceMap.get(validation.user_id);
      if (correctTolerance && validation.tolerance_meters !== correctTolerance) {
        validationsToUpdate.push({
          id: validation.id,
          user_id: validation.user_id,
          current_tolerance: validation.tolerance_meters,
          correct_tolerance: correctTolerance,
          created_at: validation.created_at
        });
      }
    });
    
    if (validationsToUpdate.length === 0) {
      console.log('✅ Toutes les validations récentes ont les bonnes valeurs de tolérance');
      return;
    }
    
    console.log(`🔧 ${validationsToUpdate.length} validations récentes à corriger`);
    
    // Afficher les détails
    console.log('\n📋 Validations à corriger:');
    validationsToUpdate.forEach(val => {
      console.log(`  Validation ${val.id} - User ${val.user_id} (${val.created_at}): ${val.current_tolerance}m → ${val.correct_tolerance}m`);
    });
    
    // Effectuer les mises à jour
    let updatedCount = 0;
    
    for (const validation of validationsToUpdate) {
      try {
        const { error: updateError } = await supabase
          .from('presence_validations')
          .update({ 
            tolerance_meters: validation.correct_tolerance,
            updated_at: new Date().toISOString()
          })
          .eq('id', validation.id);
          
        if (updateError) {
          console.error(`❌ Erreur lors de la mise à jour de la validation ${validation.id}:`, updateError);
        } else {
          updatedCount++;
          console.log(`  ✅ Validation ${validation.id} mise à jour: ${validation.current_tolerance}m → ${validation.correct_tolerance}m`);
        }
      } catch (error) {
        console.error(`❌ Erreur lors de la mise à jour de la validation ${validation.id}:`, error);
      }
    }
    
    console.log(`\n✅ Maintenance terminée: ${updatedCount} validations mises à jour`);
    
  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

// Fonction pour vérifier la cohérence globale
async function checkGlobalConsistency() {
  console.log('\n🔍 Vérification de la cohérence globale...');
  
  try {
    // Récupérer un échantillon de validations avec leurs utilisateurs
    const { data: sampleValidations, error: sampleError } = await supabase
      .from('presence_validations')
      .select('id, user_id, tolerance_meters, users!presence_validations_user_id_fkey(tolerance_radius_meters)')
      .limit(20);
      
    if (sampleError) {
      console.error('❌ Erreur lors de la vérification:', sampleError);
      return;
    }
    
    const mismatches = sampleValidations.filter(val => {
      const userTolerance = val.users?.tolerance_radius_meters;
      const validationTolerance = val.tolerance_meters;
      return userTolerance && userTolerance !== validationTolerance;
    });
    
    if (mismatches.length === 0) {
      console.log('✅ Cohérence parfaite: toutes les validations correspondent aux utilisateurs');
    } else {
      console.log(`⚠️ ${mismatches.length}/${sampleValidations.length} validations ont des valeurs incohérentes`);
      mismatches.forEach(val => {
        console.log(`  ❌ Validation ${val.id} - User ${val.user_id}: ${val.tolerance_meters}m (devrait être ${val.users?.tolerance_radius_meters}m)`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de la vérification:', error);
  }
}

// Exécuter les deux fonctions
async function runMaintenance() {
  await maintainToleranceSync();
  await checkGlobalConsistency();
}

runMaintenance().catch(console.error);
