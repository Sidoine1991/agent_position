const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function debugReportsAPI() {
  console.log('🔍 Debug complet de l\'API /reports...');
  
  const serviceSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    // Simuler un utilisateur admin (comme kolasidoine@gmail.com)
    const mockUser = {
      id: 88,
      email: 'kolasidoine@gmail.com',
      role: 'admin',
      name: 'YEBADOKPO Sidoine'
    };
    
    console.log('👤 Utilisateur simulé:', mockUser);
    
    // Étape 1: Récupérer les utilisateurs pour la map
    console.log('\n📊 Étape 1: Récupération des utilisateurs...');
    const { data: users, error: usersError } = await serviceSupabase
      .from('users')
      .select('id, name, first_name, last_name, project_name, departement, commune, arrondissement, village, reference_lat, reference_lon, tolerance_radius_meters, role')
      .in('role', ['agent', 'superviseur']);
    
    if (usersError) {
      console.error('❌ Erreur users:', usersError.message);
      return;
    }
    
    console.log('✅ Utilisateurs trouvés:', users.length);
    const usersMap = new Map(users.map(u => [u.id, u]));
    
    // Étape 2: Récupérer les validations
    console.log('\n📊 Étape 2: Récupération des validations...');
    const { data: validations, error: validationError } = await serviceSupabase
      .from('checkin_validations')
      .select(`
        id,
        checkin_id,
        agent_id,
        valid,
        distance_m,
        tolerance_m,
        reference_lat,
        reference_lon,
        created_at,
        checkins!left(
          id,
          mission_id,
          user_id,
          lat,
          lon,
          start_time,
          note,
          photo_url
        )
      `)
      .gte('created_at', '2025-11-18T00:00:00.000Z')
      .lte('created_at', '2025-11-18T23:59:59.999Z');
    
    if (validationError) {
      console.error('❌ Erreur validations:', validationError.message);
      return;
    }
    
    console.log('✅ Validations trouvées:', validations.length);
    
    // Étape 3: Filtrer par agent_ids
    console.log('\n📊 Étape 3: Filtrage par agents...');
    const agentIds = [...new Set(validations.map(v => v.agent_id))];
    console.log('🔍 Agent IDs trouvés:', agentIds);
    
    let filteredAgentIds = agentIds;
    if (mockUser.role === 'superviseur') {
      const { data: supervisedAgents } = await serviceSupabase
        .from('users')
        .select('id')
        .eq('supervisor_id', mockUser.id)
        .in('id', agentIds);
      
      filteredAgentIds = (supervisedAgents || []).map(a => a.id);
      console.log('🔍 Agents supervisés:', filteredAgentIds);
    } else if (mockUser.role === 'admin') {
      // Filtrer pour exclure les admins
      const filteredUsers = users.filter(u => u.role === 'agent' || u.role === 'superviseur');
      filteredAgentIds = filteredUsers.map(u => u.id);
      console.log('🔍 Agents (admin view):', filteredAgentIds);
    }
    
    let filteredValidations = validations.filter(validation => 
      filteredAgentIds.includes(validation.agent_id) && 
      usersMap.has(validation.agent_id)
    );
    
    console.log('✅ Validations filtrées:', filteredValidations.length);
    
    // Étape 4: Filtrage par timestamp
    console.log('\n📊 Étape 4: Filtrage par timestamp...');
    filteredValidations = filteredValidations.filter(validation => {
      const checkin = validation.checkins;
      const checkinTimestamp = checkin?.timestamp || checkin?.start_time || validation.created_at;
      const validationDate = new Date(checkinTimestamp).toDateString();
      const targetDate = new Date('2025-11-18').toDateString();
      return validationDate === targetDate;
    });
    
    console.log('✅ Validations après filtre timestamp:', filteredValidations.length);
    
    // Étape 5: Construction des rapports
    console.log('\n📊 Étape 5: Construction des rapports...');
    console.log('📊 filteredValidations length:', filteredValidations.length);
    console.log('👥 usersMap size:', usersMap.size);
    
    if (filteredValidations.length > 0) {
      console.log('🔍 Sample validation:', {
        id: filteredValidations[0].id,
        agent_id: filteredValidations[0].agent_id,
        checkins: filteredValidations[0].checkins,
        created_at: filteredValidations[0].created_at
      });
    }
    
    const reports = [];
    
    for (const validation of filteredValidations) {
      const checkin = validation.checkins;
      const user = usersMap.get(validation.agent_id);
      
      console.log(`🔍 Validation ${validation.id}: agent_id=${validation.agent_id}, user_found=${!!user}, checkin_found=${!!checkin}`);
      
      if (!user) {
        console.log(`⚠️ Utilisateur non trouvé pour agent_id ${validation.agent_id}`);
        continue;
      }
      
      // Utiliser la date de création de la validation
      const validationDate = new Date(validation.created_at);
      const dateStr = validationDate.toISOString().split('T')[0];
      
      const report = {
        id: validation.id,
        agent_id: validation.agent_id,
        agent: user?.name || `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || `Agent #${validation.agent_id}`,
        role: user?.role || 'agent',
        projet: user?.project_name || 'Non spécifié',
        departement: user?.departement || 'Non spécifié',
        commune: user?.commune || 'Non spécifié',
        date: dateStr,
        presence: validation.valid ? 'Présent' : 'Absent',
        validation: validation.valid,
        distance_m: validation.distance_m,
        reference_lat: validation.reference_lat,
        reference_lon: validation.reference_lon,
        note: checkin?.note || validation.reason || '',
        photo_url: checkin?.photo_url || null,
        created_at: validation.created_at
      };
      
      reports.push(report);
    }
    
    console.log('\n✅ Rapports générés:', reports.length);
    
    if (reports.length > 0) {
      console.log('📄 Premier rapport:', reports[0]);
      
      // Distribution des rôles
      const roleCounts = {};
      reports.forEach(r => {
        roleCounts[r.role] = (roleCounts[r.role] || 0) + 1;
      });
      console.log('📊 Distribution des rôles:', roleCounts);
    }
    
  } catch (e) {
    console.error('❌ Exception:', e.message);
    console.error('❌ Stack:', e.stack);
  }
}

debugReportsAPI();
