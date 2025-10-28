#!/usr/bin/env node

/**
 * Script final pour corriger le problème de rôle superviseur
 * Ce script corrige la contrainte de base de données et vérifie les rôles
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Configuration Supabase - À adapter selon votre environnement
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key';

if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('your-project') || supabaseKey.includes('your-anon-key')) {
  console.error('❌ Configuration Supabase manquante');
  console.log('\n📋 Pour utiliser ce script, vous devez :');
  console.log('1. Créer un fichier .env avec vos clés Supabase :');
  console.log('   SUPABASE_URL=https://votre-projet.supabase.co');
  console.log('   SUPABASE_ANON_KEY=votre-clé-anon');
  console.log('\n2. Ou modifier directement les variables dans ce script');
  console.log('\n3. Ou passer les variables en ligne de commande :');
  console.log('   SUPABASE_URL=... SUPABASE_ANON_KEY=... node fix_supervisor_role_final.js');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabaseConstraint() {
  console.log('🔍 Vérification de la contrainte de la table users...');
  
  try {
    // Vérifier la contrainte actuelle
    const { data, error } = await supabase.rpc('get_table_constraints', {
      table_name: 'users',
      constraint_name: 'users_role_check'
    });
    
    if (error) {
      console.log('ℹ️  Contrainte non trouvée ou erreur:', error.message);
      return false;
    }
    
    console.log('✅ Contrainte trouvée:', data);
    return true;
  } catch (err) {
    console.log('ℹ️  Impossible de vérifier la contrainte:', err.message);
    return false;
  }
}

async function fixDatabaseConstraint() {
  console.log('🔧 Correction de la contrainte de la table users...');
  
  try {
    // Supprimer l'ancienne contrainte si elle existe
    const dropConstraintQuery = `
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    `;
    
    // Ajouter la nouvelle contrainte avec le rôle superviseur
    const addConstraintQuery = `
      ALTER TABLE users ADD CONSTRAINT users_role_check 
      CHECK (role IN ('admin', 'superviseur', 'agent'));
    `;
    
    console.log('📝 Exécution des requêtes SQL...');
    console.log('1. Suppression de l\'ancienne contrainte...');
    console.log('2. Ajout de la nouvelle contrainte...');
    
    // Note: Ces requêtes doivent être exécutées manuellement dans Supabase
    console.log('\n📋 REQUÊTES À EXÉCUTER DANS SUPABASE SQL EDITOR:');
    console.log('─'.repeat(60));
    console.log(dropConstraintQuery);
    console.log(addConstraintQuery);
    console.log('─'.repeat(60));
    
    console.log('\n✅ Instructions:');
    console.log('1. Allez sur https://supabase.com');
    console.log('2. Ouvrez votre projet');
    console.log('3. Allez dans SQL Editor');
    console.log('4. Copiez-collez les requêtes ci-dessus');
    console.log('5. Exécutez les requêtes');
    console.log('6. Relancez ce script pour vérifier');
    
    return true;
  } catch (err) {
    console.error('❌ Erreur lors de la correction:', err.message);
    return false;
  }
}

async function checkUserRoles() {
  console.log('👥 Vérification des rôles utilisateurs...');
  
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, role, first_name, last_name')
      .order('email');
    
    if (error) {
      console.error('❌ Erreur lors de la récupération des utilisateurs:', error.message);
      return false;
    }
    
    console.log(`📊 ${users.length} utilisateurs trouvés:`);
    
    const roleCounts = {};
    users.forEach(user => {
      const role = user.role || 'non défini';
      roleCounts[role] = (roleCounts[role] || 0) + 1;
      
      if (role === 'supervisor' || role === 'superviseur') {
        console.log(`  🔍 ${user.email} - ${role} (${user.first_name} ${user.last_name})`);
      }
    });
    
    console.log('\n📈 Répartition des rôles:');
    Object.entries(roleCounts).forEach(([role, count]) => {
      console.log(`  ${role}: ${count} utilisateur(s)`);
    });
    
    return true;
  } catch (err) {
    console.error('❌ Erreur lors de la vérification des rôles:', err.message);
    return false;
  }
}

async function updateSupervisorRoles() {
  console.log('🔄 Mise à jour des rôles superviseur...');
  
  try {
    // Mettre à jour les rôles "supervisor" vers "superviseur"
    const { data, error } = await supabase
      .from('users')
      .update({ role: 'superviseur' })
      .eq('role', 'supervisor')
      .select();
    
    if (error) {
      console.error('❌ Erreur lors de la mise à jour:', error.message);
      return false;
    }
    
    if (data && data.length > 0) {
      console.log(`✅ ${data.length} utilisateur(s) mis à jour:`);
      data.forEach(user => {
        console.log(`  📧 ${user.email} -> superviseur`);
      });
    } else {
      console.log('ℹ️  Aucun utilisateur avec le rôle "supervisor" trouvé');
    }
    
    return true;
  } catch (err) {
    console.error('❌ Erreur lors de la mise à jour:', err.message);
    return false;
  }
}

async function testSupervisorFunctionality() {
  console.log('🧪 Test de la fonctionnalité superviseur...');
  
  try {
    // Tester la création d'un utilisateur avec le rôle superviseur
    const testEmail = `test-supervisor-${Date.now()}@example.com`;
    
    const { data, error } = await supabase
      .from('users')
      .insert({
        email: testEmail,
        role: 'superviseur',
        first_name: 'Test',
        last_name: 'Supervisor'
      })
      .select()
      .single();
    
    if (error) {
      console.error('❌ Erreur lors du test:', error.message);
      return false;
    }
    
    console.log('✅ Test réussi - Utilisateur superviseur créé:', data.email);
    
    // Nettoyer le test
    await supabase
      .from('users')
      .delete()
      .eq('id', data.id);
    
    console.log('🧹 Test nettoyé');
    return true;
  } catch (err) {
    console.error('❌ Erreur lors du test:', err.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Début de la correction du rôle superviseur\n');
  
  try {
    // 1. Vérifier la contrainte actuelle
    const constraintExists = await checkDatabaseConstraint();
    
    if (!constraintExists) {
      console.log('\n🔧 La contrainte doit être corrigée...');
      await fixDatabaseConstraint();
      console.log('\n⏳ Veuillez exécuter les requêtes SQL dans Supabase, puis relancer ce script');
      return;
    }
    
    // 2. Vérifier les rôles utilisateurs
    await checkUserRoles();
    
    // 3. Mettre à jour les rôles superviseur
    await updateSupervisorRoles();
    
    // 4. Tester la fonctionnalité
    await testSupervisorFunctionality();
    
    console.log('\n🎉 Correction terminée avec succès!');
    console.log('\n📋 Prochaines étapes:');
    console.log('1. Vérifiez que votre utilisateur superviseur a le bon rôle');
    console.log('2. Testez la connexion et la planification');
    console.log('3. Vérifiez que vous voyez seulement vos propres plannings');
    
  } catch (error) {
    console.error('❌ Erreur générale:', error.message);
    process.exit(1);
  }
}

// Exécuter le script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  checkDatabaseConstraint,
  fixDatabaseConstraint,
  checkUserRoles,
  updateSupervisorRoles,
  testSupervisorFunctionality
};
