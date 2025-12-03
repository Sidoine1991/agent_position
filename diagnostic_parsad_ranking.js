// Diagnostic complet du classement PARSAD directement sur Supabase
// Utilise les variables d'environnement (.env / web/.env) pour se connecter

const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Charger .env comme dans server.js
try {
  require('dotenv').config({ path: path.join(__dirname, '.env'), override: true });
  require('dotenv').config({ path: path.join(__dirname, 'web/.env'), override: false });
} catch {
  // silencieux
}

// Normalisation du nom de projet (même logique que buildProjectRanking)
function normalizeProjectName(value) {
  if (!value) return '';
  return String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

async function main() {
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ SUPABASE_URL ou SUPABASE_*_KEY manquant(e) dans .env');
    process.exit(1);
  }

  console.log('🔐 Connexion à Supabase avec les variables d\'environnement...');
  const supabase = createClient(supabaseUrl, supabaseKey);

  const targetProject = 'PARSAD';
  const projectKey = normalizeProjectName(targetProject);
  const startDate = '2025-11-01';
  const endDate = '2025-11-30';

  try {
    console.log('\n📋 1) Récupération des utilisateurs avec project_name non nul...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, first_name, last_name, email, project_name, role')
      .not('project_name', 'is', null)
      .limit(10000);

    if (usersError) {
      console.error('❌ Erreur Supabase (users):', usersError);
      process.exit(1);
    }

    const usersByNorm = users.reduce((acc, u) => {
      const key = normalizeProjectName(u.project_name);
      if (!acc[key]) acc[key] = [];
      acc[key].push(u);
      return acc;
    }, {});

    console.log('🔎 Projets trouvés (normalisés) dans users:');
    Object.entries(usersByNorm).forEach(([key, list]) => {
      console.log(`  - "${key || '(vide)'}": ${list.length} utilisateurs`);
    });

    const parsadUsers = usersByNorm[projectKey] || [];
    console.log(`\n✅ Utilisateurs PARSAD (users.project_name ~ "${targetProject}") : ${parsadUsers.length}`);

    if (parsadUsers.length) {
      console.log('   Exemple (max 10):');
      parsadUsers.slice(0, 10).forEach(u => {
        console.log(
          `   - id=${u.id}, nom=${u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email}, project_name="${u.project_name}", role=${u.role}`
        );
      });
    }

    console.log('\n📅 2) Récupération des planifications PARSAD sur novembre 2025...');
    const { data: plans, error: plansError } = await supabase
      .from('planifications')
      .select('id, user_id, project_name, date')
      .not('project_name', 'is', null)
      .gte('date', startDate)
      .lte('date', endDate)
      .limit(10000);

    if (plansError) {
      console.error('❌ Erreur Supabase (planifications):', plansError);
      process.exit(1);
    }

    const parsadPlans = plans.filter(p => normalizeProjectName(p.project_name) === projectKey);
    const parsadUserIdsFromPlans = Array.from(new Set(parsadPlans.map(p => p.user_id).filter(Boolean)));

    console.log(`✅ Planifications PARSAD en ${startDate.slice(0, 7)}: ${parsadPlans.length} lignes`);
    console.log(`   Utilisateurs distincts via planifications: ${parsadUserIdsFromPlans.length}`);

    if (parsadUserIdsFromPlans.length) {
      console.log('   Exemple (max 10 user_id):', parsadUserIdsFromPlans.slice(0, 10).join(', '));
    }

    console.log('\n🧮 3) Union des utilisateurs du projet via users + planifications...');
    const parsadUserIdsFromUsers = parsadUsers.map(u => u.id);
    const unionIdsSet = new Set([...parsadUserIdsFromUsers, ...parsadUserIdsFromPlans]);
    const unionIds = Array.from(unionIdsSet);

    console.log(`   - ids depuis users: ${parsadUserIdsFromUsers.length}`);
    console.log(`   - ids depuis planifications: ${parsadUserIdsFromPlans.length}`);
    console.log(`   => total attendu dans le classement (cible): ${unionIds.length}`);

    if (unionIds.length) {
      console.log('\n   Liste complète des ids (PARSAD) :', unionIds.join(', '));
    }

    console.log('\n⏱ 4) Vérification succincte des checkins sur la période pour ces ids...');
    if (unionIds.length) {
      const { data: checkins, error: checkinsError } = await supabase
        .from('checkins')
        .select('id, user_id, start_time')
        .in('user_id', unionIds)
        .gte('start_time', `${startDate}T00:00:00Z`)
        .lte('start_time', `${endDate}T23:59:59Z`)
        .limit(10000);

      if (checkinsError) {
        console.error('❌ Erreur Supabase (checkins):', checkinsError);
      } else {
        const byUser = new Map();
        (checkins || []).forEach(c => {
          if (!byUser.has(c.user_id)) byUser.set(c.user_id, 0);
          byUser.set(c.user_id, byUser.get(c.user_id) + 1);
        });

        console.log(`   Checkins trouvés pour ${byUser.size} agents sur ${unionIds.length} ids.`);
        unionIds.forEach(id => {
          const count = byUser.get(id) || 0;
          console.log(`   - user_id=${id}: ${count} checkins en ${startDate.slice(0, 7)}`);
        });
      }
    }

    console.log('\n✅ Diagnostic PARSAD terminé.');
  } catch (err) {
    console.error('❌ Erreur lors du diagnostic PARSAD:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}


