#!/usr/bin/env node

/**
 * Script pour vérifier l'authentification et les problèmes de planification
 */

const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

// Configuration Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET || '34f3e1679f779701810d0e0c4638401bb4cc29280de16c8b3758b42e31a614f61009548be4407037f7f4e02f218fb0f2a9de947aac91261232e7fe80b3586ea0';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Variables d\'environnement manquantes');
  process.exit(1);
}

// Initialiser le client Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function checkUsers() {
  console.log('👥 Vérification des utilisateurs existants...\n');
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, name, role, is_verified')
      .order('id');

    if (error) {
      console.log('❌ Erreur:', error.message);
      return [];
    } else {
      console.log('✅ Utilisateurs trouvés:');
      data.forEach(user => {
        const verified = user.is_verified ? '✅' : '❌';
        console.log(`   ID: ${user.id} - ${user.name} (${user.email}) - ${user.role} - ${verified}`);
      });
      
      return data;
    }
  } catch (err) {
    console.log('❌ Exception:', err.message);
    return [];
  }
}

async function testJWTToken(userId) {
  console.log(`\n🔐 Test de génération de token JWT pour l'utilisateur ${userId}...\n`);
  
  try {
    // Générer un token JWT
    const token = jwt.sign(
      { 
        id: userId, 
        email: 'test@example.com', 
        role: 'agent',
        name: 'Test User' 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('✅ Token JWT généré');
    console.log('📋 Token:', token.substring(0, 50) + '...');

    // Vérifier le token
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('✅ Token vérifié');
    console.log('📋 Contenu décodé:', decoded);

    return { token, decoded };
  } catch (err) {
    console.log('❌ Erreur lors de la génération/vérification du token:', err.message);
    return null;
  }
}

async function testPlanificationAPI(userId, token) {
  console.log(`\n🧪 Test de l'API de planification pour l'utilisateur ${userId}...\n`);
  
  const testData = {
    date: '2025-01-27',
    planned_start_time: '08:00:00',
    planned_end_time: '17:00:00',
    description_activite: 'Test via API',
    project_id: 'Test Project'
  };

  try {
    // Simuler l'appel API
    const { data, error } = await supabase
      .from('planifications')
      .upsert([{
        user_id: userId,
        date: testData.date,
        planned_start_time: testData.planned_start_time,
        planned_end_time: testData.planned_end_time,
        description_activite: testData.description_activite,
        project_name: testData.project_id,
        resultat_journee: null,
        observations: null
      }], { 
        onConflict: 'user_id,date',
        ignoreDuplicates: false 
      })
      .select()
      .single();

    if (error) {
      console.log('❌ Erreur lors de l\'insertion:', error.message);
      console.log('📋 Code d\'erreur:', error.code);
      console.log('📋 Détails:', error.details);
      
      if (error.code === '23503') {
        console.log('\n💡 Erreur de clé étrangère:');
        console.log('   - L\'utilisateur avec l\'ID', userId, 'n\'existe pas');
        console.log('   - Vérifiez que l\'utilisateur est bien enregistré');
      }
      
      return false;
    } else {
      console.log('✅ Planification insérée avec succès via API');
      console.log('📊 Données insérées:', data);
      
      // Nettoyer le test
      await supabase
        .from('planifications')
        .delete()
        .eq('id', data.id);
      console.log('🧹 Données de test supprimées');
      
      return true;
    }
  } catch (err) {
    console.log('❌ Exception lors du test API:', err.message);
    return false;
  }
}

async function checkAuthenticationFlow() {
  console.log('\n🔍 Vérification du flux d\'authentification...\n');
  
  try {
    // Vérifier la configuration JWT
    console.log('🔐 Configuration JWT:');
    console.log('   JWT_SECRET présent:', !!JWT_SECRET);
    console.log('   Longueur du secret:', JWT_SECRET ? JWT_SECRET.length : 0);
    
    // Vérifier la configuration Supabase
    console.log('\n🌐 Configuration Supabase:');
    console.log('   SUPABASE_URL présent:', !!SUPABASE_URL);
    console.log('   SUPABASE_SERVICE_ROLE_KEY présent:', !!SUPABASE_SERVICE_ROLE_KEY);
    
    return true;
  } catch (err) {
    console.log('❌ Erreur lors de la vérification:', err.message);
    return false;
  }
}

async function generateDebugScript() {
  console.log('\n📄 Génération du script de débogage...\n');
  
  const debugScript = `
-- Script de débogage pour les problèmes de planification
-- Exécutez ce script dans le SQL Editor de Supabase

-- 1. Vérifier les utilisateurs et leur statut
SELECT 
    id, 
    email, 
    name, 
    role, 
    is_verified,
    created_at
FROM users 
ORDER BY id;

-- 2. Vérifier les planifications existantes
SELECT 
    id,
    user_id,
    date,
    planned_start_time,
    planned_end_time,
    description_activite,
    project_name,
    created_at
FROM planifications 
ORDER BY created_at DESC 
LIMIT 10;

-- 3. Vérifier les contraintes de la table planifications
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'planifications'
    AND tc.constraint_type = 'FOREIGN KEY';

-- 4. Vérifier les index sur la table planifications
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'planifications';

-- 5. Test d'insertion avec un utilisateur existant
-- Remplacez USER_ID par un ID valide de la table users
/*
INSERT INTO planifications (
    user_id, 
    date, 
    planned_start_time, 
    planned_end_time, 
    description_activite, 
    project_name
) VALUES (
    USER_ID,  -- Remplacez par un ID valide
    '2025-01-27',
    '08:00:00',
    '17:00:00',
    'Test de planification',
    'Test Project'
);
*/
`;

  console.log('📋 Script de débogage généré:');
  console.log('─'.repeat(60));
  console.log(debugScript);
  console.log('─'.repeat(60));

  // Sauvegarder le script
  const fs = require('fs');
  const path = require('path');
  const scriptPath = path.join(__dirname, 'debug_planification.sql');
  
  fs.writeFileSync(scriptPath, debugScript);
  console.log(`\n💾 Script sauvegardé dans: ${scriptPath}`);
}

async function main() {
  console.log('🔍 Diagnostic des problèmes d\'authentification et de planification\n');
  console.log('═'.repeat(60));

  try {
    // Vérifier les utilisateurs
    const users = await checkUsers();
    
    if (users.length === 0) {
      console.log('\n❌ Aucun utilisateur trouvé dans la base de données');
      console.log('💡 Créez d\'abord un utilisateur via l\'interface d\'inscription');
      return;
    }

    // Vérifier le flux d'authentification
    const authOk = await checkAuthenticationFlow();
    
    if (authOk) {
      // Tester avec le premier utilisateur
      const firstUser = users[0];
      console.log(`\n🧪 Test avec l'utilisateur: ${firstUser.name} (ID: ${firstUser.id})`);
      
      // Générer un token JWT
      const tokenData = await testJWTToken(firstUser.id);
      
      if (tokenData) {
        // Tester l'API de planification
        const apiOk = await testPlanificationAPI(firstUser.id, tokenData.token);
        
        if (apiOk) {
          console.log('\n🎉 Le système fonctionne correctement!');
          console.log('💡 Le problème pourrait être:');
          console.log('   - L\'utilisateur n\'est pas connecté dans l\'application');
          console.log('   - Le token JWT a expiré');
          console.log('   - L\'ID utilisateur dans le token ne correspond pas à un utilisateur existant');
        } else {
          console.log('\n⚠️  Problème détecté avec l\'API de planification');
        }
      } else {
        console.log('\n⚠️  Problème avec la génération de token JWT');
      }
    } else {
      console.log('\n⚠️  Problème avec la configuration d\'authentification');
    }

    // Générer le script de débogage
    await generateDebugScript();

    console.log('\n💡 Instructions pour résoudre le problème:');
    console.log('─'.repeat(60));
    console.log('1. 🔐 Vérifiez que vous êtes bien connecté dans l\'application');
    console.log('2. 🔄 Déconnectez-vous et reconnectez-vous si nécessaire');
    console.log('3. 📋 Exécutez le script database/debug_planification.sql dans Supabase');
    console.log('4. 🔍 Vérifiez que votre ID utilisateur existe dans la table users');
    console.log('5. 🧪 Testez l\'enregistrement d\'une planification');

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

module.exports = { checkUsers, testJWTToken, testPlanificationAPI, checkAuthenticationFlow };
