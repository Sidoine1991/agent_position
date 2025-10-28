// Script pour assigner des superviseurs aux agents (après avoir ajouté la colonne supervisor_id manuellement)
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function main() {
  console.log('🔧 Attribution des superviseurs aux agents...\n');
  
  const supabase = createClient(
    process.env.SUPABASE_URL, 
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  try {
    // 1. Vérifier que la colonne supervisor_id existe
    console.log('1️⃣ Vérification de la colonne supervisor_id...');
    const { data: testUsers, error: testError } = await supabase
      .from('users')
      .select('id, supervisor_id')
      .limit(1);

    if (testError && testError.message.includes('supervisor_id')) {
      console.error('❌ La colonne supervisor_id n\'existe pas encore!');
      console.log('📋 Veuillez d\'abord exécuter le script SQL dans Supabase:');
      console.log('   Fichier: add_supervisor_id_manual.sql');
      return;
    }

    console.log('✅ Colonne supervisor_id trouvée');

    // 2. Récupérer tous les utilisateurs
    console.log('2️⃣ Récupération des utilisateurs...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, email, role, supervisor_id')
      .order('role', { ascending: true });

    if (usersError) {
      console.error('❌ Erreur lors de la récupération des utilisateurs:', usersError);
      return;
    }

    if (!users || users.length === 0) {
      console.log('⚠️ Aucun utilisateur trouvé');
      return;
    }

    console.log(`📊 ${users.length} utilisateurs trouvés`);

    // 3. Séparer les utilisateurs par rôle
    const supervisors = users.filter(user => user.role === 'superviseur');
    const agents = users.filter(user => user.role === 'agent');
    const admins = users.filter(user => user.role === 'admin');

    console.log(`👥 Répartition: ${agents.length} agents, ${supervisors.length} superviseurs, ${admins.length} admins`);

    // 4. Assigner des superviseurs aux agents qui n'en ont pas
    if (agents.length > 0 && supervisors.length > 0) {
      console.log('3️⃣ Attribution des superviseurs aux agents...');
      
      const agentsWithoutSupervisor = agents.filter(agent => !agent.supervisor_id);
      console.log(`📋 ${agentsWithoutSupervisor.length} agents sans superviseur`);
      
      let assignedCount = 0;
      for (let i = 0; i < agentsWithoutSupervisor.length; i++) {
        const agent = agentsWithoutSupervisor[i];
        // Assigner un superviseur de manière cyclique
        const supervisor = supervisors[i % supervisors.length];
        
        const { error: updateError } = await supabase
          .from('users')
          .update({ supervisor_id: supervisor.id })
          .eq('id', agent.id);

        if (updateError) {
          console.error(`❌ Erreur lors de l'attribution du superviseur pour l'agent ${agent.name}:`, updateError);
        } else {
          assignedCount++;
          console.log(`✅ ${agent.name} → ${supervisor.name}`);
        }
      }
      
      console.log(`🎯 ${assignedCount}/${agentsWithoutSupervisor.length} agents assignés à des superviseurs`);
    } else if (agents.length > 0 && supervisors.length === 0) {
      console.log('⚠️ Aucun superviseur trouvé. Les agents ne peuvent pas être assignés.');
      console.log('💡 Créez d\'abord des utilisateurs avec le rôle "superviseur"');
    } else {
      console.log('✅ Tous les agents ont déjà un superviseur assigné');
    }

    // 5. Vérifier les relations créées
    console.log('4️⃣ Vérification des relations créées...');
    const { data: agentsWithSupervisors, error: verifyError } = await supabase
      .from('users')
      .select(`
        id, 
        name, 
        role, 
        supervisor_id,
        supervisor:supervisor_id(name)
      `)
      .eq('role', 'agent')
      .not('supervisor_id', 'is', null);

    if (verifyError) {
      console.error('❌ Erreur lors de la vérification:', verifyError);
    } else {
      console.log(`✅ ${agentsWithSupervisors?.length || 0} agents avec superviseur assigné`);
      if (agentsWithSupervisors && agentsWithSupervisors.length > 0) {
        console.log('\n📋 Relations créées:');
        agentsWithSupervisors.forEach(agent => {
          console.log(`   ${agent.name} → ${agent.supervisor?.name || 'Superviseur inconnu'}`);
        });
      }
    }

    // 6. Afficher les agents sans superviseur
    const { data: agentsWithoutSupervisor, error: noSupervisorError } = await supabase
      .from('users')
      .select('id, name, role')
      .eq('role', 'agent')
      .is('supervisor_id', null);

    if (!noSupervisorError && agentsWithoutSupervisor && agentsWithoutSupervisor.length > 0) {
      console.log(`\n⚠️ ${agentsWithoutSupervisor.length} agents sans superviseur:`);
      agentsWithoutSupervisor.forEach(agent => {
        console.log(`   - ${agent.name}`);
      });
    }

    console.log('\n🎉 Attribution terminée!');
    console.log('\n📝 Résumé:');
    console.log(`   - ${agentsWithSupervisors?.length || 0} agents avec superviseur`);
    console.log(`   - ${agentsWithoutSupervisor?.length || 0} agents sans superviseur`);
    
    console.log('\n🔄 Redémarrez votre application pour que les changements prennent effet.');

  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

main().catch(console.error);
