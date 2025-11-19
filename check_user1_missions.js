const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkUser1Missions() {
  console.log('🔍 Vérification de l\'utilisateur ID=1 et ses missions...');
  
  try {
    // 1. Vérifier si l'utilisateur ID=1 existe
    console.log('\n👤 Étape 1: Vérification utilisateur ID=1...');
    const { data: user1, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', 1)
      .single();
    
    if (userError) {
      console.error('❌ Erreur recherche utilisateur ID=1:', userError);
      console.log('ℹ️ L\'utilisateur ID=1 n\'existe probablement pas');
    } else {
      console.log('✅ Utilisateur ID=1 trouvé:', user1);
    }
    
    // 2. Vérifier les checkins avec user_id=1
    console.log('\n📍 Étape 2: Checkins avec user_id=1...');
    const { data: checkinsUser1, error: checkinsError } = await supabase
      .from('checkins')
      .select('*')
      .eq('user_id', 1)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (checkinsError) {
      console.error('❌ Erreur checkins user 1:', checkinsError);
    } else {
      console.log(`✅ ${checkinsUser1?.length || 0} checkins trouvés pour user_id=1`);
      if (checkinsUser1 && checkinsUser1.length > 0) {
        checkinsUser1.forEach((checkin, index) => {
          console.log(`  ${index + 1}. ID: ${checkin.id}, Mission: ${checkin.mission_id}, Time: ${checkin.created_at}`);
        });
      }
    }
    
    // 3. Pour chaque mission, vérifier l'agent_id
    console.log('\n🎯 Étape 3: Analyse des missions...');
    if (checkinsUser1 && checkinsUser1.length > 0) {
      const missionIds = [...new Set(checkinsUser1.map(c => c.mission_id).filter(id => id))];
      console.log(`📋 ${missionIds.length} missions uniques à vérifier`);
      
      for (const missionId of missionIds) {
        console.log(`\n🔍 Mission ID: ${missionId}`);
        
        // Vérifier la mission
        const { data: mission, error: missionError } = await supabase
          .from('missions')
          .select('*')
          .eq('id', missionId)
          .single();
        
        if (missionError) {
          console.error(`❌ Erreur mission ${missionId}:`, missionError);
          continue;
        }
        
        console.log(`📊 Mission trouvée: Agent ID=${mission.agent_id}, Status=${mission.status}`);
        
        // Vérifier l'agent de la mission
        const { data: agent, error: agentError } = await supabase
          .from('users')
          .select('id, name, email, role')
          .eq('id', mission.agent_id)
          .single();
        
        if (agentError) {
          console.error(`❌ Erreur agent ${mission.agent_id}:`, agentError);
        } else {
          console.log(`👤 Agent: ${agent.name} (${agent.email}) - Role: ${agent.role}`);
        }
        
        // Vérifier s'il y a des présences pour cette mission
        const { data: missionPresences, error: presencesError } = await supabase
          .from('presences')
          .select('*')
          .eq('user_id', mission.agent_id)
          .order('created_at', { ascending: false })
          .limit(3);
        
        if (presencesError) {
          console.error(`❌ Erreur présences agent ${mission.agent_id}:`, presencesError);
        } else {
          console.log(`📈 ${missionPresences?.length || 0} présences pour l'agent ${mission.agent_id}`);
        }
      }
    }
    
    // 4. Vérifier tous les utilisateurs pour voir si ID=1 existe vraiment
    console.log('\n👥 Étape 4: Vérification complète des utilisateurs...');
    const { data: allUsers, error: allUsersError } = await supabase
      .from('users')
      .select('id, name, email, role')
      .order('id', { ascending: true })
      .limit(10);
    
    if (allUsersError) {
      console.error('❌ Erreur utilisateurs:', allUsersError);
    } else {
      console.log('📋 10 premiers utilisateurs:');
      allUsers.forEach((user, index) => {
        console.log(`  ${index + 1}. ID: ${user.id}, Name: ${user.name}, Email: ${user.email}, Role: ${user.role}`);
      });
      
      const hasUser1 = allUsers.some(user => user.id === 1);
      console.log(`\n❓ User ID=1 existe: ${hasUser1 ? 'OUI' : 'NON'}`);
    }
    
    // 5. Proposer une correction
    console.log('\n🔧 Étape 5: Analyse et correction...');
    
    if (!user1 && checkinsUser1 && checkinsUser1.length > 0) {
      console.log('🚨 PROBLÈME DÉTECTÉ:');
      console.log('   - Des checkins existent avec user_id=1');
      console.log('   - Mais l\'utilisateur ID=1 n\'existe pas dans la table users');
      console.log('   - Cela cause des erreurs de foreign key lors de la création des présences');
      
      console.log('\n💡 SOLUTIONS POSSIBLES:');
      console.log('1. Supprimer les checkins avec user_id=1 invalide');
      console.log('2. Mettre à jour ces checkins avec le bon user_id');
      console.log('3. Créer un utilisateur ID=1 (non recommandé)');
      
      // Trouver le premier utilisateur valide
      const { data: firstValidUser } = await supabase
        .from('users')
        .select('id, name')
        .eq('role', 'agent')
        .order('id', { ascending: true })
        .limit(1)
        .single();
      
      if (firstValidUser) {
        console.log(`\n🔧 Proposition: Mettre à jour les checkins user_id=1 vers user_id=${firstValidUser.id} (${firstValidUser.name})`);
        
        // Demander confirmation
        console.log('\n❓ Voulez-vous appliquer cette correction ?');
        console.log('Cette action va mettre à jour tous les checkins avec user_id=1 vers user_id=' + firstValidUser.id);
        
        // Pour l'instant, juste montrer ce qui serait fait
        console.log('\n📋 Checkins qui seraient mis à jour:');
        checkinsUser1.forEach((checkin, index) => {
          console.log(`  ${index + 1}. Checkin ID ${checkin.id} → User ID ${firstValidUser.id}`);
        });
      }
    }
    
    console.log('\n🎉 Analyse terminée!');
    
  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

checkUser1Missions();
