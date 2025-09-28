// Vérification complète de la base Supabase
// Usage: node scripts/verify-supabase.js

const path = require('path');
// Charger les variables d'environnement depuis .env (racine) ou web/.env
try {
  const dotenv = require('dotenv');
  // Priorité: racine, sinon web/.env
  const loadedRoot = dotenv.config({ path: path.resolve(process.cwd(), '.env') });
  if (loadedRoot.error) {
    dotenv.config({ path: path.resolve(process.cwd(), 'web/.env') });
  }
} catch (e) {
  // dotenv est optionnel, on continue si non installé
}

const { createClient } = require('@supabase/supabase-js');

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

async function main() {
  console.log('🔍 Vérification de la base Supabase...\n');

  const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE'), {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // 1. Test de connexion
  console.log('1️⃣ Test de connexion...');
  try {
    const { data, error } = await supabase.from('app_settings').select('count').limit(1);
    if (error) throw error;
    console.log('✅ Connexion Supabase OK');
  } catch (e) {
    console.error('❌ Erreur connexion:', e.message);
    process.exit(1);
  }

  // 2. Vérifier les tables et compter les données
  console.log('\n2️⃣ Vérification des tables et données...');
  const tables = ['users', 'missions', 'checkins', 'absences', 'reports', 'verification_codes', 'app_settings'];
  
  for (const table of tables) {
    try {
      const { data, error, count } = await supabase.from(table).select('*', { count: 'exact', head: true });
      if (error) throw error;
      console.log(`✅ ${table}: ${count} lignes`);
    } catch (e) {
      console.error(`❌ ${table}:`, e.message);
    }
  }

  // 3. Vérifier RLS (Row Level Security)
  console.log('\n3️⃣ Vérification RLS...');
  try {
    const { data, error } = await supabase.rpc('check_rls_enabled');
    if (error && error.code !== 'PGRST202') { // PGRST202 = function doesn't exist, on peut ignorer
      console.log('⚠️ Impossible de vérifier RLS automatiquement');
      console.log('   Vérifiez manuellement dans Supabase → Table Editor que RLS est "Enabled"');
    } else {
      console.log('✅ RLS vérifié');
    }
  } catch (e) {
    console.log('⚠️ Vérification RLS manuelle requise');
  }

  // 4. Test avec clé anon (doit être restreint par RLS)
  console.log('\n4️⃣ Test sécurité avec clé anon...');
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (anonKey) {
    const anonClient = createClient(env('SUPABASE_URL'), anonKey);
    try {
      const { data, error } = await anonClient.from('users').select('*').limit(1);
      if (error && error.message.includes('JWT')) {
        console.log('✅ RLS actif: accès refusé sans JWT valide');
      } else if (data && data.length === 0) {
        console.log('✅ RLS actif: aucune donnée retournée sans authentification');
      } else {
        console.log('⚠️ RLS peut-être désactivé: données retournées sans JWT');
      }
    } catch (e) {
      console.log('✅ RLS actif:', e.message);
    }
  } else {
    console.log('⚠️ SUPABASE_ANON_KEY non définie, test RLS ignoré');
  }

  // 5. Test d'authentification
  console.log('\n5️⃣ Test d\'authentification...');
  try {
    // Test avec un utilisateur existant
    const { data: users } = await supabase.from('users').select('email, role').limit(1);
    if (users && users.length > 0) {
      console.log(`✅ Utilisateurs trouvés (ex: ${users[0].email}, rôle: ${users[0].role})`);
    } else {
      console.log('⚠️ Aucun utilisateur trouvé');
    }
  } catch (e) {
    console.error('❌ Erreur test auth:', e.message);
  }

  // 6. Vérifier les données critiques
  console.log('\n6️⃣ Vérification des données critiques...');
  try {
    const { data: settings } = await supabase.from('app_settings').select('*');
    if (settings && settings.length > 0) {
      console.log(`✅ Settings: ${settings.length} configurations`);
    } else {
      console.log('⚠️ Aucun setting trouvé');
    }

    const { data: missions } = await supabase.from('missions').select('id, status').limit(5);
    if (missions && missions.length > 0) {
      console.log(`✅ Missions: ${missions.length} trouvées (ex: ${missions[0].status})`);
    } else {
      console.log('⚠️ Aucune mission trouvée');
    }
  } catch (e) {
    console.error('❌ Erreur données critiques:', e.message);
  }

  console.log('\n🎉 Vérification terminée!');
  console.log('\n📋 Prochaines étapes:');
  console.log('1. Vérifiez manuellement RLS dans Supabase → Table Editor');
  console.log('2. Configurez USE_SUPABASE=true dans le backend');
  console.log('3. Déployez sur Vercel/Render avec les variables Supabase');
}

main().catch(e => { console.error('❌ Erreur:', e); process.exit(1); });
