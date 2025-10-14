const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variables d\'environnement Supabase manquantes');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateCherifAgent() {
  try {
    console.log('🔄 Mise à jour des informations de CHERIF FABADE DEKANDE LUC...');
    
    // Rechercher l'agent par email
    const { data: existingAgent, error: searchError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'lucherifabade@gmail.com')
      .single();
    
    if (searchError && searchError.code !== 'PGRST116') {
      throw searchError;
    }
    
    if (!existingAgent) {
      console.error('❌ Agent non trouvé avec l\'email: lucherifabade@gmail.com');
      return;
    }
    
    console.log('👤 Agent trouvé:', existingAgent.name);
    console.log('📧 Email:', existingAgent.email);
    
    // Préparer les données de mise à jour
    const updateData = {
      name: 'CHERIF FABADE DEKANDE LUC',
      phone: '0197721043',
      departement: 'Collines',
      commune: 'Savalou',
      arrondissement: 'OUESSE',
      village: 'AKETE',
      reference_lat: 7.987124,
      reference_lon: 1.886619,
      contract_start_date: '2025-02-03',
      contract_end_date: '2027-03-31',
      years_of_service: 5.0,
      tolerance_radius_meters: 5000
    };
    
    console.log('📝 Données à mettre à jour:', updateData);
    
    // Mettre à jour l'agent
    const { data: updatedAgent, error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('email', 'lucherifabade@gmail.com')
      .select()
      .single();
    
    if (updateError) {
      throw updateError;
    }
    
    console.log('✅ Agent mis à jour avec succès !');
    console.log('📋 Nouvelles informations:');
    console.log('   Nom:', updatedAgent.name);
    console.log('   Téléphone:', updatedAgent.phone);
    console.log('   Département:', updatedAgent.departement);
    console.log('   Commune:', updatedAgent.commune);
    console.log('   Arrondissement:', updatedAgent.arrondissement);
    console.log('   Village:', updatedAgent.village);
    console.log('   Latitude:', updatedAgent.reference_lat);
    console.log('   Longitude:', updatedAgent.reference_lon);
    console.log('   Début contrat:', updatedAgent.contract_start_date);
    console.log('   Fin contrat:', updatedAgent.contract_end_date);
    console.log('   Expérience:', updatedAgent.years_of_service, 'ans');
    
  } catch (error) {
    console.error('❌ Erreur lors de la mise à jour:', error.message);
    console.error('Détails:', error);
  }
}

// Exécuter la mise à jour
updateCherifAgent();
