const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const SUPABASE_URL = 'https://eoamsmtdspedumjmmeui.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvYW1zbXRkc3BlZHVtam1tZXVpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTAyNzIzOSwiZXhwIjoyMDc0NjAzMjM5fQ.SrDG8nvNxALqUSqXw3tGWuv9hgLF-bSyUdNmxcoYm_Y';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function syncToleranceValidations() {
  console.log('🔄 Synchronisation des valeurs de tolérance dans presence_validations...');
  
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
    
    console.log(`👥 ${users.length} utilisateurs trouvés avec tolerance_radius_meters`);
    
    // Créer un map pour un accès rapide
    const userToleranceMap = new Map();
    users.forEach(user => {
      userToleranceMap.set(user.id, user.tolerance_radius_meters);
    });
    
    // Récupérer toutes les validations qui ont des valeurs incorrectes
    const { data: validations, error: validationsError } = await supabase
      .from('presence_validations')
      .select('id, user_id, tolerance_meters')
      .not('user_id', 'is', null);
      
    if (validationsError) {
      console.error('❌ Erreur lors de la récupération des validations:', validationsError);
      return;
    }
    
    console.log(`📊 ${validations.length} validations trouvées`);
    
    // Identifier les validations à corriger
    const validationsToUpdate = [];
    
    validations.forEach(validation => {
      const correctTolerance = userToleranceMap.get(validation.user_id);
      if (correctTolerance && validation.tolerance_meters !== correctTolerance) {
        validationsToUpdate.push({
          id: validation.id,
          user_id: validation.user_id,
          current_tolerance: validation.tolerance_meters,
          correct_tolerance: correctTolerance
        });
      }
    });
    
    console.log(`🔧 ${validationsToUpdate.length} validations à corriger`);
    
    if (validationsToUpdate.length === 0) {
      console.log('✅ Toutes les validations ont déjà les bonnes valeurs de tolérance');
      return;
    }
    
    // Afficher quelques exemples
    console.log('\n📋 Exemples de corrections à effectuer:');
    validationsToUpdate.slice(0, 5).forEach(val => {
      console.log(`  Validation ${val.id} - User ${val.user_id}: ${val.current_tolerance}m → ${val.correct_tolerance}m`);
    });
    
    // Effectuer les mises à jour par batch
    const batchSize = 50;
    let updatedCount = 0;
    
    for (let i = 0; i < validationsToUpdate.length; i += batchSize) {
      const batch = validationsToUpdate.slice(i, i + batchSize);
      
      console.log(`\n🔄 Traitement du batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(validationsToUpdate.length / batchSize)}...`);
      
      for (const validation of batch) {
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
            if (updatedCount % 10 === 0) {
              console.log(`  ✅ ${updatedCount} validations mises à jour...`);
            }
          }
        } catch (error) {
          console.error(`❌ Erreur lors de la mise à jour de la validation ${validation.id}:`, error);
        }
      }
      
      // Petite pause entre les batches
      if (i + batchSize < validationsToUpdate.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`\n✅ Synchronisation terminée: ${updatedCount} validations mises à jour`);
    
    // Vérification finale
    console.log('\n🔍 Vérification finale...');
    const { data: sampleValidations, error: sampleError } = await supabase
      .from('presence_validations')
      .select('id, user_id, tolerance_meters, users!presence_validations_user_id_fkey(tolerance_radius_meters)')
      .limit(5);
      
    if (!sampleError && sampleValidations) {
      console.log('📊 Échantillon après correction:');
      sampleValidations.forEach(val => {
        const userTolerance = val.users?.tolerance_radius_meters;
        const validationTolerance = val.tolerance_meters;
        const match = userTolerance === validationTolerance ? '✅' : '❌';
        console.log(`  ${match} Validation ${val.id} - User ${val.user_id}: ${validationTolerance}m (devrait être ${userTolerance}m)`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

syncToleranceValidations().catch(console.error);
