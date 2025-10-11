#!/usr/bin/env node

/**
 * Script pour vérifier la table weekly_planning_summary
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variables d\'environnement manquantes');
  process.exit(1);
}

// Initialiser le client Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function checkTables() {
  console.log('🔍 Vérification des tables disponibles...\n');
  
  try {
    // Lister les tables
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .order('table_name');

    if (error) {
      console.log('❌ Erreur:', error.message);
      return;
    }

    console.log('📋 Tables disponibles:');
    data.forEach(table => {
      console.log(`   - ${table.table_name}`);
    });

    // Vérifier si weekly_planning_summary existe
    const hasWeeklySummary = data.some(t => t.table_name === 'weekly_planning_summary');
    console.log(`\n📊 Table weekly_planning_summary: ${hasWeeklySummary ? 'EXISTE' : 'N\'EXISTE PAS'}`);

    // Vérifier les planifications
    const { data: plans, error: planError } = await supabase
      .from('planifications')
      .select('count', { head: true });

    if (planError) {
      console.log('❌ Erreur planifications:', planError.message);
    } else {
      console.log('✅ Table planifications accessible');
    }

    return { hasWeeklySummary, tables: data };
  } catch (err) {
    console.log('❌ Exception:', err.message);
    return { hasWeeklySummary: false, tables: [] };
  }
}

async function generateWeeklySummaryFromPlanifications() {
  console.log('\n📊 Génération du récap hebdomadaire depuis les planifications...\n');
  
  try {
    // Récupérer les planifications de la semaine actuelle
    const today = new Date();
    const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
    const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6));
    
    const from = startOfWeek.toISOString().split('T')[0];
    const to = endOfWeek.toISOString().split('T')[0];

    console.log(`📅 Période: ${from} à ${to}`);

    const { data: planifications, error } = await supabase
      .from('planifications')
      .select(`
        *,
        users(name, email, project_name)
      `)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: false });

    if (error) {
      console.log('❌ Erreur:', error.message);
      return [];
    }

    console.log(`✅ Planifications trouvées: ${planifications.length}`);

    if (planifications.length > 0) {
      console.log('\n📋 Détails des planifications:');
      planifications.forEach((plan, index) => {
        const userName = plan.user ? plan.user.name : `Utilisateur ${plan.user_id}`;
        console.log(`   ${index + 1}. ${plan.date} - ${userName} - Projet: ${plan.project_name || 'Aucun'}`);
      });

      // Grouper par semaine et agent
      const weeklySummary = {};
      planifications.forEach(plan => {
        const weekKey = `${plan.user_id}_${from}`;
        if (!weeklySummary[weekKey]) {
          weeklySummary[weekKey] = {
            user_id: plan.user_id,
            user_name: plan.user ? plan.user.name : `Utilisateur ${plan.user_id}`,
            week_start_date: from,
            week_end_date: to,
            project_name: plan.project_name || 'Aucun',
            total_planned_hours: 0,
            planned_days: new Set(),
            activities: []
          };
        }
        
        // Calculer les heures planifiées
        if (plan.planned_start_time && plan.planned_end_time) {
          const start = new Date(`2000-01-01T${plan.planned_start_time}`);
          const end = new Date(`2000-01-01T${plan.planned_end_time}`);
          const hours = (end - start) / (1000 * 60 * 60);
          weeklySummary[weekKey].total_planned_hours += hours;
        }
        
        weeklySummary[weekKey].planned_days.add(plan.date);
        weeklySummary[weekKey].activities.push({
          date: plan.date,
          activity: plan.description_activite || 'Aucune activité',
          start_time: plan.planned_start_time,
          end_time: plan.planned_end_time
        });
      });

      // Convertir en array
      const summaryArray = Object.values(weeklySummary).map(summary => ({
        ...summary,
        planned_days: Array.from(summary.planned_days).length
      }));

      console.log('\n📊 Récap hebdomadaire généré:');
      summaryArray.forEach((summary, index) => {
        console.log(`   ${index + 1}. ${summary.user_name} - ${summary.planned_days} jours - ${summary.total_planned_hours.toFixed(1)}h - Projet: ${summary.project_name}`);
      });

      return summaryArray;
    }

    return [];
  } catch (err) {
    console.log('❌ Exception:', err.message);
    return [];
  }
}

async function generateFixedEndpointCode() {
  console.log('\n📄 Génération du code d\'endpoint corrigé...\n');
  
  const fixedCode = `
// Endpoint corrigé pour /api/planifications/weekly-summary
// Remplacez le code existant dans api/index.js

if (path === '/api/planifications/weekly-summary' && method === 'GET') {
  authenticateToken(req, res, async () => {
    try {
      const { from, to, project_name, agent_id } = req.query;
      
      // Générer le récap hebdomadaire depuis les planifications
      let query = supabaseClient
        .from('planifications')
        .select(\`
          *,
          users(name, email, project_name)
        \`);

      // Filtrer par utilisateur si agent_id est spécifié
      if (agent_id) {
        query = query.eq('user_id', agent_id);
      } else if (req.user.role === 'admin' || req.user.role === 'superviseur') {
        // Les admins et superviseurs voient toutes les planifications
        // Pas de filtre par user_id
      } else {
        // Les agents voient seulement leurs propres planifications
        query = query.eq('user_id', req.user.id);
      }

      if (from) query = query.gte('date', from);
      if (to) query = query.lte('date', to);
      if (project_name) {
        query = query.eq('project_name', project_name);
      }

      const { data: planifications, error } = await query.order('date', { ascending: false });

      if (error) throw error;

      // Enrichir avec les données utilisateurs séparément
      if (planifications && planifications.length > 0) {
        const userIds = [...new Set(planifications.map(p => p.user_id).filter(Boolean))];
        const { data: users } = await supabaseClient
          .from('users')
          .select('id, name, email, role, project_name')
          .in('id', userIds);

        const usersMap = new Map(users.map(u => [u.id, u]));
        const enrichedPlanifications = planifications.map(plan => ({
          ...plan,
          user: usersMap.get(plan.user_id) || null
        }));

        // Grouper par semaine et agent
        const weeklySummary = {};
        enrichedPlanifications.forEach(plan => {
          const weekKey = \`\${plan.user_id}_\${from}\`;
          if (!weeklySummary[weekKey]) {
            weeklySummary[weekKey] = {
              user_id: plan.user_id,
              user_name: plan.user ? plan.user.name : \`Utilisateur \${plan.user_id}\`,
              week_start_date: from,
              week_end_date: to,
              project_name: plan.project_name || 'Aucun',
              total_planned_hours: 0,
              planned_days: new Set(),
              activities: []
            };
          }
          
          // Calculer les heures planifiées
          if (plan.planned_start_time && plan.planned_end_time) {
            const start = new Date(\`2000-01-01T\${plan.planned_start_time}\`);
            const end = new Date(\`2000-01-01T\${plan.planned_end_time}\`);
            const hours = (end - start) / (1000 * 60 * 60);
            weeklySummary[weekKey].total_planned_hours += hours;
          }
          
          weeklySummary[weekKey].planned_days.add(plan.date);
          weeklySummary[weekKey].activities.push({
            date: plan.date,
            activity: plan.description_activite || 'Aucune activité',
            start_time: plan.planned_start_time,
            end_time: plan.planned_end_time
          });
        });

        // Convertir en array
        const summaryArray = Object.values(weeklySummary).map(summary => ({
          ...summary,
          planned_days: Array.from(summary.planned_days).length
        }));

        return res.json({
          success: true,
          items: summaryArray
        });
      }

      return res.json({
        success: true,
        items: []
      });
    } catch (error) {
      console.error('Erreur récap hebdomadaire:', error);
      return res.status(500).json({ error: 'Erreur serveur' });
    }
  });
  return;
}
`;

  console.log('📋 Code d\'endpoint corrigé:');
  console.log('─'.repeat(60));
  console.log(fixedCode);
  console.log('─'.repeat(60));

  // Sauvegarder le code
  const fs = require('fs');
  const path = require('path');
  const codePath = path.join(__dirname, 'fix_weekly_summary_endpoint.js');
  
  fs.writeFileSync(codePath, fixedCode);
  console.log(`\n💾 Code sauvegardé dans: ${codePath}`);
}

async function main() {
  console.log('🔍 Diagnostic de l\'endpoint weekly-summary\n');
  console.log('═'.repeat(60));

  try {
    // Vérifier les tables
    const { hasWeeklySummary, tables } = await checkTables();
    
    // Générer le récap depuis les planifications
    const weeklySummary = await generateWeeklySummaryFromPlanifications();
    
    // Générer le code corrigé
    await generateFixedEndpointCode();

    console.log('\n📊 Résumé du diagnostic:');
    console.log('─'.repeat(60));
    console.log(`Table weekly_planning_summary: ${hasWeeklySummary ? 'EXISTE' : 'N\'EXISTE PAS'}`);
    console.log(`Tables disponibles: ${tables.length}`);
    console.log(`Récap généré: ${weeklySummary.length} entrées`);

    console.log('\n💡 Solution:');
    console.log('─'.repeat(60));
    console.log('1. 📝 Remplacez l\'endpoint /api/planifications/weekly-summary dans api/index.js');
    console.log('2. 🔄 Utilisez le code généré dans database/fix_weekly_summary_endpoint.js');
    console.log('3. ✅ L\'endpoint générera le récap depuis la table planifications');

    console.log('\n✨ Diagnostic terminé!');

  } catch (error) {
    console.error('❌ Erreur fatale lors du diagnostic:', error.message);
    process.exit(1);
  }
}

// Exécuter le script
if (require.main === module) {
  main();
}

module.exports = { checkTables, generateWeeklySummaryFromPlanifications, generateFixedEndpointCode };
