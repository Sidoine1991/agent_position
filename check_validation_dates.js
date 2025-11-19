const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkValidationDates() {
  try {
    console.log('🔍 Vérification des dates avec validations...');
    
    // Vérifier les dates récentes avec des validations
    const { data: validations, error: validationsError } = await supabase
      .from('checkin_validations')
      .select(`
        created_at,
        agent_id,
        valid,
        users!inner (
          id,
          role,
          name,
          project_name
        )
      `)
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (validationsError) {
      console.error('❌ Erreur validations:', validationsError);
      return;
    }
    
    console.log(`📊 Total validations trouvées: ${validations?.length || 0}`);
    
    if (validations && validations.length > 0) {
      console.log('\n🔍 Validations récentes:');
      const dates = {};
      
      validations.forEach((v, i) => {
        const date = v.created_at.split('T')[0];
        dates[date] = (dates[date] || 0) + 1;
        
        console.log(`  ${i + 1}. Date: ${date}, Agent: ${v.users.name} (Role: ${v.users.role}, Projet: ${v.users.project_name})`);
      });
      
      console.log('\n📈 Validations par date:');
      Object.entries(dates).forEach(([date, count]) => {
        console.log(`  - ${date}: ${count}`);
      });
      
      // Regrouper par rôle
      const roles = {};
      validations.forEach(v => {
        const role = v.users.role;
        roles[role] = (roles[role] || 0) + 1;
      });
      
      console.log('\n👥 Validations par rôle:');
      Object.entries(roles).forEach(([role, count]) => {
        console.log(`  - ${role}: ${count}`);
      });
    }
    
    // Vérifier spécifiquement pour les agents
    console.log('\n🔍 Vérification spécifique pour les agents...');
    
    const { data: agentValidations, error: agentError } = await supabase
      .from('checkin_validations')
      .select(`
        created_at,
        agent_id,
        valid,
        users!inner (
          id,
          role,
          name,
          project_name
        )
      `)
      .eq('users.role', 'agent')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (agentError) {
      console.error('❌ Erreur agents:', agentError);
    } else {
      console.log(`📊 Validations agents: ${agentValidations?.length || 0}`);
      
      if (agentValidations && agentValidations.length > 0) {
        console.log('🔍 Exemples de validations agents:');
        agentValidations.forEach((v, i) => {
          console.log(`  ${i + 1}. Date: ${v.created_at.split('T')[0]}, Agent: ${v.users.name} (Projet: ${v.users.project_name})`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

checkValidationDates();
