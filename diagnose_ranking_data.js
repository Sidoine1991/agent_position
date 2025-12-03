const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function diagnoseRankingData() {
  console.log('🔍 DIAGNOSTIC DES DONNÉES DE CLASSEMENT\n');
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Configuration Supabase manquante');
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // 1. Vérifier les agents du projet PARSAD
    console.log('1️⃣ Vérification des agents du projet PARSAD...');
    const { data: parsadAgents, error: agentsError } = await supabase
      .from('users')
      .select('id, name, first_name, last_name, project_name, role')
      .eq('project_name', 'PARSAD')
      .in('role', ['agent', 'supervisor']);
    
    if (agentsError) {
      console.error('❌ Erreur récupération agents PARSAD:', agentsError);
      return;
    }
    
    console.log(`✅ ${parsadAgents.length} agents trouvés dans PARSAD:`);
    parsadAgents.forEach(agent => {
      console.log(`  - ${agent.name || `${agent.first_name} ${agent.last_name}`} (ID: ${agent.id})`);
    });
    
    // 2. Définir la période pour novembre 2025
    const monthStart = '2025-11-01';
    const monthEnd = '2025-11-30';
    const startIso = '2025-11-01T00:00:00.000Z';
    const endIso = '2025-11-30T23:59:59.999Z';
    
    console.log(`\n2️⃣ Période analysée: ${monthStart} au ${monthEnd}`);
    
    // 3. Vérifier les checkins pour tous les agents PARSAD
    console.log('\n3️⃣ Vérification des checkins...');
    let totalCheckins = 0;
    
    for (const agent of parsadAgents) {
      const { data: checkins, error: checkinsError } = await supabase
        .from('checkins')
        .select('created_at')
        .eq('user_id', agent.id)
        .gte('created_at', startIso)
        .lte('created_at', endIso);
      
      if (checkinsError) {
        console.warn(`⚠️ Erreur checkins agent ${agent.id}:`, checkinsError.message);
      } else {
        const count = checkins?.length || 0;
        totalCheckins += count;
        if (count > 0) {
          console.log(`  ✅ ${agent.name}: ${count} checkins`);
        }
      }
    }
    
    console.log(`📊 Total checkins PARSAD pour novembre 2025: ${totalCheckins}`);
    
    // 4. Vérifier les planifications
    console.log('\n4️⃣ Vérification des planifications...');
    let totalPlanifications = 0;
    let totalRealized = 0;
    
    for (const agent of parsadAgents) {
      const { data: planifications, error: planifsError } = await supabase
        .from('planifications')
        .select('date, description_activite, resultat_journee')
        .eq('user_id', agent.id)
        .gte('date', monthStart)
        .lte('date', monthEnd);
      
      if (planifsError) {
        console.warn(`⚠️ Erreur planifs agent ${agent.id}:`, planifsError.message);
      } else {
        const count = planifications?.length || 0;
        const realized = planifications?.filter(p => {
          const result = String(p.resultat_journee || '').toLowerCase();
          return result.includes('réalis') || result.includes('realise') || result.includes('fait');
        }).length || 0;
        
        totalPlanifications += count;
        totalRealized += realized;
        
        if (count > 0) {
          console.log(`  ✅ ${agent.name}: ${count} planifications (${realized} réalisées)`);
        }
      }
    }
    
    console.log(`📊 Total planifications PARSAD pour novembre 2025: ${totalPlanifications}`);
    console.log(`📊 Total réalisations PARSAD pour novembre 2025: ${totalRealized}`);
    
    // 5. Vérifier s'il y a des données dans d'autres mois
    console.log('\n5️⃣ Vérification des données dans d\'autres mois...');
    
    // Checkins des 3 derniers mois
    const { data: recentCheckins, error: recentError } = await supabase
      .from('checkins')
      .select('created_at, user_id')
      .gte('created_at', '2025-09-01T00:00:00.000Z')
      .lte('created_at', '2025-11-30T23:59:59.999Z')
      .in('user_id', parsadAgents.map(a => a.id));
    
    if (recentError) {
      console.warn('⚠️ Erreur checkins récents:', recentError.message);
    } else {
      const byMonth = {};
      (recentCheckins || []).forEach(checkin => {
        const month = new Date(checkin.created_at).toISOString().substring(0, 7);
        byMonth[month] = (byMonth[month] || 0) + 1;
      });
      
      console.log('📊 Checkins par mois:');
      Object.entries(byMonth).forEach(([month, count]) => {
        console.log(`  - ${month}: ${count} checkins`);
      });
    }
    
    // 6. Recommandations
    console.log('\n📋 RECOMMANDATIONS:');
    
    if (totalCheckins === 0 && totalPlanifications === 0) {
      console.log('⚠️ Aucune donnée trouvée pour novembre 2025');
      console.log('🔧 Solutions possibles:');
      console.log('  1. Vérifier que les agents ont bien fait des checkins en novembre 2025');
      console.log('  2. Vérifier que les planifications ont été créées pour novembre 2025');
      console.log('  3. Tester avec un mois plus récent où il y a des données');
      console.log('  4. Ajouter des données de test pour vérifier le fonctionnement');
    } else {
      console.log('✅ Données trouvées - le problème vient probablement du calcul');
    }
    
  } catch (error) {
    console.error('❌ Erreur inattendue:', error);
  }
}

diagnoseRankingData();
