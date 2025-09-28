// Vider complètement la base Supabase
// Usage: node scripts/clear-supabase.js

const path = require('path');
// Charger les variables d'environnement
try {
  const dotenv = require('dotenv');
  const loadedRoot = dotenv.config({ path: path.resolve(process.cwd(), '.env') });
  if (loadedRoot.error) {
    dotenv.config({ path: path.resolve(process.cwd(), 'web/.env') });
  }
} catch (e) {
  // dotenv optionnel
}

const { createClient } = require('@supabase/supabase-js');

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

async function main() {
  console.log('🗑️ Vidage complet de la base Supabase...\n');

  const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE'), {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Ordre de suppression (respecter les contraintes FK)
  const tables = [
    'checkins',      // FK vers missions
    'absences',      // FK vers users  
    'reports',       // FK vers users
    'missions',      // FK vers users
    'verification_codes', // Pas de FK
    'users',         // Table principale
    'app_settings'   // Pas de FK
  ];

  for (const table of tables) {
    console.log(`🗑️ Suppression de ${table}...`);
    try {
      const { error } = await supabase.from(table).delete().neq('id', 0); // Supprime tout
      if (error) throw error;
      console.log(`✅ ${table} vidé`);
    } catch (e) {
      console.error(`❌ Erreur ${table}:`, e.message);
    }
  }

  // Réinitialiser les séquences (IDs)
  console.log('\n🔄 Réinitialisation des séquences...');
  const sequences = [
    'users_id_seq',
    'missions_id_seq', 
    'checkins_id_seq',
    'absences_id_seq',
    'reports_id_seq',
    'verification_codes_id_seq'
  ];

  for (const seq of sequences) {
    try {
      const { error } = await supabase.rpc('reset_sequence', { seq_name: seq });
      if (error && !error.message.includes('does not exist')) {
        console.log(`⚠️ ${seq}: ${error.message}`);
      } else {
        console.log(`✅ ${seq} réinitialisé`);
      }
    } catch (e) {
      console.log(`⚠️ ${seq}: ${e.message}`);
    }
  }

  console.log('\n✅ Base Supabase complètement vidée!');
  console.log('📋 Prochaines étapes:');
  console.log('1. Basculer le backend vers Supabase');
  console.log('2. Déployer sur Vercel avec variables Supabase');
}

main().catch(e => { console.error('❌ Erreur:', e); process.exit(1); });
