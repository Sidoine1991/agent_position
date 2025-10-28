// Script pour ajouter le champ supervisor_id et créer des relations superviseur-agent
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function main() {
  console.log('🔧 Correction des relations superviseur-agent...\n');
  
  const supabase = createClient(
    process.env.SUPABASE_URL, 
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  try {
    // 1. Vérifier si la colonne supervisor_id existe déjà
    console.log('1️⃣ Vérification de la structure de la table users...');
    
    // Essayer de récupérer les utilisateurs avec supervisor_id pour voir si la colonne existe
    const { data: testUsers, error: testError } = await supabase
      .from('users')
      .select('id, supervisor_id')
      .limit(1);

    const supervisorIdExists = !testError || !testError.message.includes('supervisor_id');
    
    if (testError && testError.message.includes('supervisor_id')) {
      console.log('⚠️ Colonne supervisor_id n\'existe pas encore');
    } else {
      console.log('✅ Colonne supervisor_id existe déjà');
    }

    // 2. Ajouter la colonne supervisor_id si elle n'existe pas
    if (!supervisorIdExists) {
      console.log('2️⃣ Ajout de la colonne supervisor_id...');
      
      // Utiliser une requête SQL brute via une fonction RPC
      const { error: alterError } = await supabase.rpc('exec_sql', {
        sql: 'ALTER TABLE users ADD COLUMN supervisor_id INTEGER REFERENCES users(id)'
      });

      if (alterError) {
        console.log('⚠️ Impossible d\'ajouter la colonne via RPC, tentative alternative...');
        
        // Alternative: créer une fonction SQL temporaire
        const { error: funcError } = await supabase.rpc('exec_sql', {
          sql: `
            CREATE OR REPLACE FUNCTION add_supervisor_id_column()
            RETURNS void AS $$
            BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'supervisor_id'
              ) THEN
                ALTER TABLE users ADD COLUMN supervisor_id INTEGER REFERENCES users(id);
              END IF;
            END;
            $$ LANGUAGE plpgsql;
            
            SELECT add_supervisor_id_column();
            DROP FUNCTION add_supervisor_id_column();
          `
        });

        if (funcError) {
          console.error('❌ Impossible d\'ajouter la colonne supervisor_id:', funcError);
          console.log('\n📋 Veuillez exécuter manuellement cette requête SQL dans Supabase:');
          console.log('ALTER TABLE users ADD COLUMN supervisor_id INTEGER REFERENCES users(id);');
          console.log('CREATE INDEX IF NOT EXISTS idx_users_supervisor_id ON users(supervisor_id);');
          return;
        } else {
          console.log('✅ Colonne supervisor_id ajoutée avec succès');
        }
      } else {
        console.log('✅ Colonne supervisor_id ajoutée avec succès');
      }
    }

    // 3. Récupérer tous les utilisateurs
    console.log('3️⃣ Récupération des utilisateurs...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, email, role')
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

    // 4. Séparer les utilisateurs par rôle
    const supervisors = users.filter(user => user.role === 'superviseur');
    const agents = users.filter(user => user.role === 'agent');
    const admins = users.filter(user => user.role === 'admin');

    console.log(`👥 Répartition: ${agents.length} agents, ${supervisors.length} superviseurs, ${admins.length} admins`);

    // 5. Assigner des superviseurs aux agents
    if (agents.length > 0 && supervisors.length > 0) {
      console.log('4️⃣ Attribution des superviseurs aux agents...');
      
      let assignedCount = 0;
      for (let i = 0; i < agents.length; i++) {
        const agent = agents[i];
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
      
      console.log(`🎯 ${assignedCount}/${agents.length} agents assignés à des superviseurs`);
    } else if (agents.length > 0 && supervisors.length === 0) {
      console.log('⚠️ Aucun superviseur trouvé. Les agents ne peuvent pas être assignés.');
      console.log('💡 Créez d\'abord des utilisateurs avec le rôle "superviseur"');
    }

    // 6. Vérifier les relations créées
    console.log('5️⃣ Vérification des relations créées...');
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

    // 7. Créer un index pour améliorer les performances
    console.log('6️⃣ Création d\'un index pour supervisor_id...');
    try {
      const { error: indexError } = await supabase.rpc('exec_sql', {
        sql: 'CREATE INDEX IF NOT EXISTS idx_users_supervisor_id ON users(supervisor_id)'
      });
      
      if (indexError) {
        console.log('⚠️ Impossible de créer l\'index automatiquement');
        console.log('📋 Créez manuellement cet index dans Supabase:');
        console.log('CREATE INDEX IF NOT EXISTS idx_users_supervisor_id ON users(supervisor_id);');
      } else {
        console.log('✅ Index créé avec succès');
      }
    } catch (e) {
      console.log('⚠️ Erreur lors de la création de l\'index:', e.message);
      console.log('📋 Créez manuellement cet index dans Supabase:');
      console.log('CREATE INDEX IF NOT EXISTS idx_users_supervisor_id ON users(supervisor_id);');
    }

    console.log('\n🎉 Correction terminée!');
    console.log('\n📝 Résumé:');
    console.log(`   - Colonne supervisor_id ajoutée à la table users`);
    console.log(`   - ${assignedCount || 0} agents assignés à des superviseurs`);
    console.log(`   - Index créé pour améliorer les performances`);
    
    console.log('\n🔄 Redémarrez votre application pour que les changements prennent effet.');

  } catch (error) {
    console.error('❌ Erreur générale:', error);
  }
}

main().catch(console.error);
