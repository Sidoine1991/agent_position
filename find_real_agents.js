const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function findRealAgents() {
  try {
    console.log('🔍 Recherche des vrais agents...');
    
    // 1. Lister tous les utilisateurs par rôle
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, role, name, project_name')
      .order('role');
    
    if (usersError) {
      console.error('❌ Erreur utilisateurs:', usersError);
      return;
    }
    
    console.log(`📊 Total utilisateurs: ${users?.length || 0}`);
    
    const roles = {};
    users?.forEach(u => {
      roles[u.role] = (roles[u.role] || 0) + 1;
    });
    
    console.log('\n👥 Répartition par rôle:');
    Object.entries(roles).forEach(([role, count]) => {
      console.log(`  - ${role}: ${count}`);
    });
    
    // 2. Afficher les agents
    const agents = users?.filter(u => u.role === 'agent') || [];
    console.log(`\n🔍 Agents (${agents.length}):`);
    agents.forEach((a, i) => {
      console.log(`  ${i + 1}. ID: ${a.id}, Name: ${a.name}, Project: ${a.project_name}`);
    });
    
    // 3. Vérifier les checkins récents et voir qui les a faits
    console.log('\n🔍 Vérification des checkins récents...');
    
    const { data: recentCheckins, error: checkinsError } = await supabase
      .from('checkins')
      .select(`
        id,
        user_id,
        created_at,
        missions!inner (
          agent_id
        )
      `)
      .gte('created_at', '2025-11-18T00:00:00.000Z')
      .lte('created_at', '2025-11-18T23:59:59.999Z')
      .limit(10);
    
    if (checkinsError) {
      console.error('❌ Erreur checkins:', checkinsError);
      return;
    }
    
    console.log(`📊 Checkins récents: ${recentCheckins?.length || 0}`);
    
    if (recentCheckins && recentCheckins.length > 0) {
      console.log('\n🔍 Checkins récents:');
      recentCheckins.forEach((c, i) => {
        console.log(`  ${i + 1}. Checkin ID: ${c.id}, User ID: ${c.user_id}, Mission Agent ID: ${c.missions?.agent_id}, Date: ${c.created_at}`);
      });
    }
    
    // 4. Vérifier s'il y a des missions récentes pour les agents
    console.log('\n🔍 Missions récentes pour agents...');
    
    const { data: agentMissions, error: missionsError } = await supabase
      .from('missions')
      .select(`
        id,
        agent_id,
        status,
        date_start,
        users!inner (
          role,
          name
        )
      `)
      .eq('users.role', 'agent')
      .gte('date_start', '2025-11-18T00:00:00.000Z')
      .lte('date_start', '2025-11-18T23:59:59.999Z')
      .limit(10);
    
    if (missionsError) {
      console.error('❌ Erreur missions:', missionsError);
      return;
    }
    
    console.log(`📊 Missions agents récentes: ${agentMissions?.length || 0}`);
    
    if (agentMissions && agentMissions.length > 0) {
      console.log('\n🔍 Missions agents récentes:');
      agentMissions.forEach((m, i) => {
        console.log(`  ${i + 1}. Mission ID: ${m.id}, Agent ID: ${m.agent_id}, Agent: ${m.users.name}, Status: ${m.status}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

findRealAgents();
