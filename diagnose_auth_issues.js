const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function diagnoseAuthIssues() {
  console.log('🔍 DIAGNOSTIC DES PROBLÈMES D\'AUTHENTIFICATION\n');
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Variables d\'environnement Supabase manquantes');
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // 1. Vérifier la connexion à la base
    console.log('1️⃣ Test de connexion à la base...');
    const { data: testData, error: testError } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.error('❌ Erreur de connexion:', testError);
      return;
    }
    console.log('✅ Connexion à la base réussie');
    
    // 2. Vérifier l'utilisateur ID 88 (présent dans les logs)
    console.log('\n2️⃣ Vérification de l\'utilisateur ID 88...');
    const { data: user88, error: user88Error } = await supabase
      .from('users')
      .select('*')
      .eq('id', 88)
      .single();
    
    if (user88Error) {
      if (user88Error.code === 'PGRST116') {
        console.log('⚠️ Utilisateur ID 88 non trouvé');
      } else {
        console.error('❌ Erreur lors de la recherche de l\'utilisateur 88:', user88Error);
      }
    } else {
      console.log('✅ Utilisateur 88 trouvé:', {
        id: user88.id,
        email: user88.email,
        role: user88.role,
        name: user88.name,
        project_name: user88.project_name
      });
    }
    
    // 3. Vérifier les rôles des utilisateurs
    console.log('\n3️⃣ Vérification des rôles des utilisateurs...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, role, name, project_name')
      .in('role', ['admin', 'supervisor', 'superviseur', 'agent'])
      .order('role');
    
    if (usersError) {
      console.error('❌ Erreur lors de la récupération des utilisateurs:', usersError);
    } else {
      console.log('✅ Utilisateurs trouvés par rôle:');
      users.forEach(user => {
        console.log(`  - ${user.role}: ${user.name || user.email} (ID: ${user.id})`);
      });
    }
    
    // 4. Vérifier les checkins récents
    console.log('\n4️⃣ Vérification des checkins récents...');
    const { data: recentCheckins, error: checkinsError } = await supabase
      .from('checkins')
      .select('id, user_id, created_at, lat, lon')
      .eq('user_id', 88)
      .gte('created_at', '2025-10-31T23:00:00.000Z')
      .lte('created_at', '2025-11-30T22:59:59.000Z')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (checkinsError) {
      console.error('❌ Erreur lors de la récupération des checkins:', checkinsError);
    } else {
      console.log(`✅ ${recentCheckins.length} checkins trouvés pour l'utilisateur 88`);
      recentCheckins.forEach(checkin => {
        console.log(`  - ${checkin.created_at}: Lat ${checkin.lat}, Lon ${checkin.lon}`);
      });
    }
    
    // 5. Vérifier les tables analytics
    console.log('\n5️⃣ Vérification des tables analytics...');
    
    const tables = ['missions', 'presences', 'emergency_alerts', 'user_badges'];
    for (const table of tables) {
      try {
        const { data: tableData, error: tableError } = await supabase
          .from(table)
          .select('count')
          .limit(1);
        
        if (tableError) {
          if (tableError.code === 'PGRST116') {
            console.log(`⚠️ Table '${table}' n'existe pas`);
          } else {
            console.log(`❌ Erreur table '${table}':`, tableError.message);
          }
        } else {
          console.log(`✅ Table '${table}' accessible`);
        }
      } catch (e) {
        console.log(`❌ Erreur critique table '${table}':`, e.message);
      }
    }
    
    // 6. Recommandations
    console.log('\n📋 RECOMMANDATIONS:');
    
    if (!user88) {
      console.log('⚠️ Créer l\'utilisateur ID 88 ou vérifier l\'ID dans le frontend');
    }
    
    if (user88 && !['admin', 'supervisor', 'superviseur', 'agent'].includes(user88.role)) {
      console.log('⚠️ Assigner un rôle valide à l\'utilisateur 88');
    }
    
    console.log('✅ Vérifier que les tokens JWT sont correctement signés avec JWT_SECRET');
    console.log('✅ Assurer que les permissions des endpoints correspondent aux rôles des utilisateurs');
    
  } catch (error) {
    console.error('❌ Erreur inattendue:', error);
  }
}

diagnoseAuthIssues();
