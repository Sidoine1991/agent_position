const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAllValidations() {
  try {
    console.log('🔍 Vérification complète des validations...');
    
    // Compter le total
    const { count, error: countError } = await supabase
      .from('checkin_validations')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Erreur comptage:', countError);
      return;
    }
    
    console.log(`📊 Total validations dans la table: ${count}`);
    
    // Vérifier les validations récentes sans jointure
    const { data: validations, error: validationsError } = await supabase
      .from('checkin_validations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (validationsError) {
      console.error('❌ Erreur validations:', validationsError);
      return;
    }
    
    console.log(`📊 Validations récupérées: ${validations?.length || 0}`);
    
    if (validations && validations.length > 0) {
      console.log('\n🔍 Validations récentes:');
      validations.forEach((v, i) => {
        console.log(`  ${i + 1}. ID: ${v.id}, Agent: ${v.agent_id}, Valid: ${v.valid}, Date: ${v.created_at}`);
      });
      
      // Vérifier si les agent_id correspondent à des utilisateurs existants
      const agentIds = [...new Set(validations.map(v => v.agent_id))];
      
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, role, name')
        .in('id', agentIds);
      
      if (usersError) {
        console.error('❌ Erreur utilisateurs:', usersError);
      } else {
        console.log('\n👥 Utilisateurs correspondants:');
        users.forEach((u, i) => {
          console.log(`  ${i + 1}. ID: ${u.id}, Role: ${u.role}, Name: ${u.name}`);
        });
        
        // Vérifier quels agents manquent
        const foundUserIds = new Set((users || []).map(u => u.id));
        const missingAgents = agentIds.filter(id => !foundUserIds.has(id));
        
        if (missingAgents.length > 0) {
          console.log('\n⚠️ Agents non trouvés dans la table users:');
          missingAgents.forEach(id => {
            console.log(`  - Agent ID: ${id}`);
          });
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

checkAllValidations();
