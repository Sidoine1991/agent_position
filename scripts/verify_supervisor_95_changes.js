const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const SUPABASE_URL = 'https://eoamsmtdspedumjmmeui.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvYW1zbXRkc3BlZHVtam1tZXVpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTAyNzIzOSwiZXhwIjoyMDc0NjAzMjM5fQ.SrDG8nvNxALqUSqXw3tGWuv9hgLF-bSyUdNmxcoYm_Y';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function verifySupervisor95Changes() {
  const supervisorId = 95;
  const supervisorName = 'AGBANI BABATOUNDE KOTCHIKPA EPHREM CONSTANTIN';
  
  console.log(`🔍 Vérification des modifications pour le superviseur ${supervisorId} (${supervisorName})...`);
  
  try {
    // 1. Vérifier presence_validations
    console.log('\n📊 Vérification de la table presence_validations...');
    
    const { data: validations, error: validationsError } = await supabase
      .from('presence_validations')
      .select('id, validation_status, checkin_timestamp, checkin_type, within_tolerance')
      .eq('user_id', supervisorId)
      .order('checkin_timestamp', { ascending: false });
    
    if (validationsError) {
      console.error('❌ Erreur lors de la récupération des validations:', validationsError);
      return;
    }
    
    console.log(`📋 ${validations.length} validations trouvées`);
    
    // Compter les statuts
    const validationStatusCounts = {};
    validations.forEach(v => {
      validationStatusCounts[v.validation_status] = (validationStatusCounts[v.validation_status] || 0) + 1;
    });
    
    console.log('📊 Répartition des statuts de validation:');
    Object.entries(validationStatusCounts).forEach(([status, count]) => {
      const icon = status === 'validated' ? '✅' : status === 'rejected' ? '❌' : '⚠️';
      console.log(`  ${icon} ${status}: ${count}`);
    });
    
    // 2. Vérifier presences
    console.log('\n📊 Vérification de la table presences...');
    
    const { data: presences, error: presencesError } = await supabase
      .from('presences')
      .select('id, checkin_type, start_time, within_tolerance, status')
      .eq('user_id', supervisorId)
      .order('start_time', { ascending: false });
    
    if (presencesError) {
      console.error('❌ Erreur lors de la récupération des presences:', presencesError);
      return;
    }
    
    console.log(`📋 ${presences.length} presences trouvées`);
    
    // Compter les types de checkin
    const checkinTypeCounts = {};
    presences.forEach(p => {
      checkinTypeCounts[p.checkin_type] = (checkinTypeCounts[p.checkin_type] || 0) + 1;
    });
    
    console.log('📊 Répartition des types de checkin:');
    Object.entries(checkinTypeCounts).forEach(([type, count]) => {
      const icon = type === 'validated' ? '✅' : type === 'rejected' ? '❌' : '⚠️';
      console.log(`  ${icon} ${type}: ${count}`);
    });
    
    // 3. Afficher les détails des dernières entrées
    console.log('\n📋 Détails des 5 dernières validations:');
    validations.slice(0, 5).forEach(val => {
      console.log(`  Validation ${val.id}: ${val.validation_status} | ${val.checkin_type} | ${val.within_tolerance ? 'Dans tolérance' : 'Hors tolérance'} | ${val.checkin_timestamp}`);
    });
    
    console.log('\n📋 Détails des 5 dernières presences:');
    presences.slice(0, 5).forEach(pres => {
      console.log(`  Presence ${pres.id}: ${pres.checkin_type} | ${pres.within_tolerance ? 'Dans tolérance' : 'Hors tolérance'} | ${pres.status} | ${pres.start_time}`);
    });
    
    // 4. Vérifier s'il reste des entrées "rejected"
    const rejectedValidations = validations.filter(v => v.validation_status === 'rejected');
    const rejectedPresences = presences.filter(p => p.checkin_type === 'rejected');
    
    console.log('\n🔍 Vérification des entrées "rejected" restantes:');
    console.log(`📊 Validations "rejected": ${rejectedValidations.length}`);
    console.log(`📊 Presences "rejected": ${rejectedPresences.length}`);
    
    if (rejectedValidations.length === 0 && rejectedPresences.length === 0) {
      console.log('✅ Aucune entrée "rejected" trouvée - Toutes les modifications ont été appliquées avec succès!');
    } else {
      console.log('⚠️ Il reste des entrées "rejected" à traiter');
    }
    
    // 5. Résumé des données du superviseur
    console.log('\n👤 Informations du superviseur:');
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('name, role, tolerance_radius_meters, project_name, departement, commune')
      .eq('id', supervisorId)
      .single();
    
    if (!userError && user) {
      console.log(`  Nom: ${user.name}`);
      console.log(`  Rôle: ${user.role}`);
      console.log(`  Tolérance: ${user.tolerance_radius_meters}m`);
      console.log(`  Projet: ${user.project_name}`);
      console.log(`  Localisation: ${user.departement} - ${user.commune}`);
    }
    
  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

verifySupervisor95Changes().catch(console.error);
