#!/usr/bin/env node

/**
 * Script de diagnostic pour les filtres de planification
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

async function checkUsersData() {
  console.log('👥 Vérification des données utilisateurs...\n');
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id,name,email,role,project_name,departement,commune,arrondissement,village')
      .order('name');
    
    if (error) {
      console.log('❌ Erreur:', error.message);
      return [];
    }

    console.log('✅ Utilisateurs récupérés:', data.length);
    
    if (data.length > 0) {
      console.log('\n📋 Détails des utilisateurs:');
      data.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.name} (${user.email}) - ${user.role} - Projet: ${user.project_name || 'Aucun'}`);
      });
      
      // Filtrer les agents
      const agents = data.filter(user => user.role === 'agent');
      console.log(`\n👥 Agents trouvés: ${agents.length}`);
      
      // Extraire les projets
      const projects = new Set();
      data.forEach(user => {
        if (user.project_name && user.project_name.trim()) {
          projects.add(user.project_name.trim());
        }
      });
      console.log(`📁 Projets trouvés: ${Array.from(projects).length}`);
      console.log('📋 Liste des projets:', Array.from(projects));
      
      return { users: data, agents, projects: Array.from(projects) };
    }
    
    return { users: [], agents: [], projects: [] };
  } catch (err) {
    console.log('❌ Exception:', err.message);
    return { users: [], agents: [], projects: [] };
  }
}

async function checkPlanificationsData() {
  console.log('\n📋 Vérification des données de planification...\n');
  
  try {
    const { data, error } = await supabase
      .from('planifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.log('❌ Erreur:', error.message);
      return [];
    }

    console.log('✅ Planifications récupérées:', data.length);
    
    if (data.length > 0) {
      console.log('\n📋 Détails des planifications:');
      data.forEach((plan, index) => {
        console.log(`   ${index + 1}. Agent ID: ${plan.user_id} - Date: ${plan.date} - Projet: ${plan.project_name || 'Aucun'} - Activité: ${plan.description_activite || 'Aucune'}`);
      });
    }
    
    return data;
  } catch (err) {
    console.log('❌ Exception:', err.message);
    return [];
  }
}

async function checkProjectNameConsistency() {
  console.log('\n🔍 Vérification de la cohérence des noms de projets...\n');
  
  try {
    // Vérifier les projets dans la table users
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('project_name')
      .not('project_name', 'is', null);
    
    if (userError) {
      console.log('❌ Erreur users:', userError.message);
      return;
    }

    // Vérifier les projets dans la table planifications
    const { data: plans, error: planError } = await supabase
      .from('planifications')
      .select('project_name')
      .not('project_name', 'is', null);
    
    if (planError) {
      console.log('❌ Erreur planifications:', planError.message);
      return;
    }

    const userProjects = new Set(users.map(u => u.project_name?.trim()).filter(Boolean));
    const planProjects = new Set(plans.map(p => p.project_name?.trim()).filter(Boolean));
    
    console.log('📁 Projets dans users:', Array.from(userProjects));
    console.log('📁 Projets dans planifications:', Array.from(planProjects));
    
    const allProjects = new Set([...userProjects, ...planProjects]);
    console.log('📁 Tous les projets uniques:', Array.from(allProjects));
    
    // Vérifier les incohérences
    const inconsistencies = [];
    userProjects.forEach(project => {
      if (!planProjects.has(project)) {
        inconsistencies.push(`Projet "${project}" dans users mais pas dans planifications`);
      }
    });
    planProjects.forEach(project => {
      if (!userProjects.has(project)) {
        inconsistencies.push(`Projet "${project}" dans planifications mais pas dans users`);
      }
    });
    
    if (inconsistencies.length > 0) {
      console.log('\n⚠️  Incohérences détectées:');
      inconsistencies.forEach(inc => console.log(`   - ${inc}`));
    } else {
      console.log('\n✅ Aucune incohérence détectée');
    }
    
  } catch (err) {
    console.log('❌ Exception:', err.message);
  }
}

async function generateFixScript() {
  console.log('\n📄 Génération du script de correction...\n');
  
  const fixScript = `
-- Script de diagnostic et correction pour les filtres de planification
-- Exécutez ce script dans le SQL Editor de Supabase

-- 1. Vérifier les utilisateurs et leurs projets
SELECT 
    id,
    name,
    email,
    role,
    project_name,
    CASE 
        WHEN project_name IS NULL OR project_name = '' THEN '❌ Projet manquant'
        ELSE '✅ Projet défini'
    END as project_status
FROM users 
ORDER BY role, name;

-- 2. Vérifier les planifications et leurs projets
SELECT 
    id,
    user_id,
    date,
    project_name,
    description_activite,
    CASE 
        WHEN project_name IS NULL OR project_name = '' THEN '❌ Projet manquant'
        ELSE '✅ Projet défini'
    END as project_status
FROM planifications 
ORDER BY created_at DESC 
LIMIT 20;

-- 3. Compter les utilisateurs par rôle
SELECT 
    role,
    COUNT(*) as count,
    COUNT(CASE WHEN project_name IS NOT NULL AND project_name != '' THEN 1 END) as with_project,
    COUNT(CASE WHEN project_name IS NULL OR project_name = '' THEN 1 END) as without_project
FROM users 
GROUP BY role
ORDER BY role;

-- 4. Compter les planifications par projet
SELECT 
    project_name,
    COUNT(*) as count,
    COUNT(DISTINCT user_id) as unique_users
FROM planifications 
WHERE project_name IS NOT NULL AND project_name != ''
GROUP BY project_name
ORDER BY count DESC;

-- 5. Vérifier les agents sans projet
SELECT 
    id,
    name,
    email,
    project_name
FROM users 
WHERE role = 'agent' 
    AND (project_name IS NULL OR project_name = '')
ORDER BY name;

-- 6. Mettre à jour les agents sans projet (optionnel)
-- Décommentez et modifiez selon vos besoins
/*
UPDATE users 
SET project_name = 'Projet par défaut'
WHERE role = 'agent' 
    AND (project_name IS NULL OR project_name = '');
*/

-- 7. Vérifier les planifications sans projet
SELECT 
    id,
    user_id,
    date,
    project_name,
    description_activite
FROM planifications 
WHERE project_name IS NULL OR project_name = ''
ORDER BY created_at DESC;
`;

  console.log('📋 Script de diagnostic généré:');
  console.log('─'.repeat(60));
  console.log(fixScript);
  console.log('─'.repeat(60));

  // Sauvegarder le script
  const fs = require('fs');
  const path = require('path');
  const scriptPath = path.join(__dirname, 'diagnose_planning_filters.sql');
  
  fs.writeFileSync(scriptPath, fixScript);
  console.log(`\n💾 Script sauvegardé dans: ${scriptPath}`);
}

async function main() {
  console.log('🔍 Diagnostic des filtres de planification\n');
  console.log('═'.repeat(60));

  try {
    // Vérifier les données utilisateurs
    const { users, agents, projects } = await checkUsersData();
    
    // Vérifier les données de planification
    const planifications = await checkPlanificationsData();
    
    // Vérifier la cohérence des projets
    await checkProjectNameConsistency();
    
    console.log('\n📊 Résumé du diagnostic:');
    console.log('─'.repeat(60));
    console.log(`Utilisateurs totaux: ${users.length}`);
    console.log(`Agents: ${agents.length}`);
    console.log(`Projets uniques: ${projects.length}`);
    console.log(`Planifications: ${planifications.length}`);
    
    if (agents.length === 0) {
      console.log('\n⚠️  Problème identifié:');
      console.log('   - Aucun agent trouvé dans la base de données');
      console.log('   - Le filtre "Agent" sera vide');
      console.log('   - Vérifiez que des utilisateurs avec role="agent" existent');
    }
    
    if (projects.length === 0) {
      console.log('\n⚠️  Problème identifié:');
      console.log('   - Aucun projet trouvé dans la base de données');
      console.log('   - Le filtre "Projet" sera vide');
      console.log('   - Vérifiez que les utilisateurs ont un project_name défini');
    }
    
    if (planifications.length === 0) {
      console.log('\n⚠️  Problème identifié:');
      console.log('   - Aucune planification trouvée dans la base de données');
      console.log('   - Les données de planification ne s\'afficheront pas');
      console.log('   - Vérifiez que des planifications existent');
    }

    // Générer le script de diagnostic
    await generateFixScript();

    console.log('\n💡 Instructions pour résoudre le problème:');
    console.log('─'.repeat(60));
    console.log('1. 📋 Exécutez le script database/diagnose_planning_filters.sql dans Supabase');
    console.log('2. 🔍 Vérifiez que des agents existent avec role="agent"');
    console.log('3. 🔍 Vérifiez que les agents ont un project_name défini');
    console.log('4. 🔍 Vérifiez que des planifications existent dans la table');
    console.log('5. 🔄 Rechargez la page de planification dans l\'application');
    console.log('6. 🧪 Testez les filtres Agent et Projet');

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

module.exports = { checkUsersData, checkPlanificationsData, checkProjectNameConsistency };
