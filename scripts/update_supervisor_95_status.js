const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const SUPABASE_URL = 'https://eoamsmtdspedumjmmeui.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvYW1zbXRkc3BlZHVtam1tZXVpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTAyNzIzOSwiZXhwIjoyMDc0NjAzMjM5fQ.SrDG8nvNxALqUSqXw3tGWuv9hgLF-bSyUdNmxcoYm_Y';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function updateSupervisor95Status() {
  const supervisorId = 95;
  const supervisorName = 'AGBANI BABATOUNDE KOTCHIKPA EPHREM CONSTANTIN';
  
  console.log(`🔄 Mise à jour des statuts pour le superviseur ${supervisorId} (${supervisorName})...`);
  
  try {
    // 1. Mettre à jour presence_validations - validation_status de "rejected" à "validated"
    console.log('\n📊 Mise à jour de la table presence_validations...');
    
    const { data: validationsBefore, error: validationsBeforeError } = await supabase
      .from('presence_validations')
      .select('id, validation_status, checkin_timestamp')
      .eq('user_id', supervisorId)
      .in('validation_status', ['rejected', 'pending']);
    
    if (validationsBeforeError) {
      console.error('❌ Erreur lors de la récupération des validations:', validationsBeforeError);
      return;
    }
    
    console.log(`📋 ${validationsBefore.length} validations trouvées avec statut "rejected" ou "pending"`);
    
    if (validationsBefore.length > 0) {
      const { error: updateValidationsError } = await supabase
        .from('presence_validations')
        .update({ 
          validation_status: 'validated',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', supervisorId)
        .in('validation_status', ['rejected', 'pending']);
      
      if (updateValidationsError) {
        console.error('❌ Erreur lors de la mise à jour des validations:', updateValidationsError);
        return;
      }
      
      console.log(`✅ ${validationsBefore.length} validations mises à jour vers "validated"`);
    } else {
      console.log('ℹ️ Aucune validation "rejected" ou "pending" trouvée');
    }
    
    // 2. Mettre à jour presences - checkin_type de "rejected" à "validated"
    console.log('\n📊 Mise à jour de la table presences...');
    
    const { data: presencesBefore, error: presencesBeforeError } = await supabase
      .from('presences')
      .select('id, checkin_type, start_time')
      .eq('user_id', supervisorId)
      .eq('checkin_type', 'rejected');
    
    if (presencesBeforeError) {
      console.error('❌ Erreur lors de la récupération des presences:', presencesBeforeError);
      return;
    }
    
    console.log(`📋 ${presencesBefore.length} presences trouvées avec checkin_type "rejected"`);
    
    if (presencesBefore.length > 0) {
      const { error: updatePresencesError } = await supabase
        .from('presences')
        .update({ 
          checkin_type: 'validated'
        })
        .eq('user_id', supervisorId)
        .eq('checkin_type', 'rejected');
      
      if (updatePresencesError) {
        console.error('❌ Erreur lors de la mise à jour des presences:', updatePresencesError);
        return;
      }
      
      console.log(`✅ ${presencesBefore.length} presences mises à jour vers "validated"`);
    } else {
      console.log('ℹ️ Aucune présence "rejected" trouvée');
    }
    
    // 3. Vérification finale
    console.log('\n🔍 Vérification finale...');
    
    // Vérifier presence_validations
    const { data: validationsAfter, error: validationsAfterError } = await supabase
      .from('presence_validations')
      .select('id, validation_status, checkin_timestamp')
      .eq('user_id', supervisorId)
      .order('checkin_timestamp', { ascending: false })
      .limit(5);
    
    if (!validationsAfterError && validationsAfter) {
      console.log('📊 Dernières validations après mise à jour:');
      validationsAfter.forEach(val => {
        console.log(`  Validation ${val.id}: ${val.validation_status} (${val.checkin_timestamp})`);
      });
    }
    
    // Vérifier presences
    const { data: presencesAfter, error: presencesAfterError } = await supabase
      .from('presences')
      .select('id, checkin_type, start_time')
      .eq('user_id', supervisorId)
      .order('start_time', { ascending: false })
      .limit(5);
    
    if (!presencesAfterError && presencesAfter) {
      console.log('📊 Dernières presences après mise à jour:');
      presencesAfter.forEach(pres => {
        console.log(`  Presence ${pres.id}: ${pres.checkin_type} (${pres.start_time})`);
      });
    }
    
    // Compter les statuts finaux
    const { data: finalValidations, error: finalValidationsError } = await supabase
      .from('presence_validations')
      .select('validation_status')
      .eq('user_id', supervisorId);
    
    const { data: finalPresences, error: finalPresencesError } = await supabase
      .from('presences')
      .select('checkin_type')
      .eq('user_id', supervisorId);
    
    if (!finalValidationsError && !finalPresencesError) {
      console.log('\n📈 Résumé final:');
      
      // Compter les statuts de validation
      const validationCounts = {};
      finalValidations.forEach(v => {
        validationCounts[v.validation_status] = (validationCounts[v.validation_status] || 0) + 1;
      });
      
      console.log('📊 presence_validations:');
      Object.entries(validationCounts).forEach(([status, count]) => {
        console.log(`  ${status}: ${count}`);
      });
      
      // Compter les types de checkin
      const presenceCounts = {};
      finalPresences.forEach(p => {
        presenceCounts[p.checkin_type] = (presenceCounts[p.checkin_type] || 0) + 1;
      });
      
      console.log('📊 presences:');
      Object.entries(presenceCounts).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });
    }
    
    console.log('\n✅ Mise à jour terminée avec succès!');
    
  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

updateSupervisor95Status().catch(console.error);
