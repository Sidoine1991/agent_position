// Migration Render Postgres -> Supabase
// Usage: node scripts/migrate-to-supabase.js
// Required env: DATABASE_URL (Render), SUPABASE_URL, SUPABASE_SERVICE_ROLE

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

const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

async function main() {
  const pg = new Client({ connectionString: env('DATABASE_URL'), ssl: { rejectUnauthorized: false } });
  await pg.connect();

  const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE'), {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  console.log('🔎 Lecture des données depuis Render Postgres...');
  const tables = ['users','missions','checkins','absences','reports','verification_codes','app_settings'];

  for (const table of tables) {
    console.log(`→ ${table}`);
    const { rows } = await pg.query(`SELECT * FROM ${table}`);
    if (!rows || rows.length === 0) { console.log('  (vide)'); continue; }

    // Normaliser lignes (dates -> ISO)
    let sanitized = rows.map(r => {
      const copy = { ...r };
      // Dates en ISO string
      Object.keys(copy).forEach(k => {
        if (copy[k] instanceof Date) copy[k] = copy[k].toISOString();
      });
      return copy;
    });

    // Insertion résiliente: si une colonne n'existe pas dans Supabase,
    // on la retire dynamiquement et on réessaie
    const removeColumnEverywhere = (col) => {
      sanitized = sanitized.map(obj => { const o = { ...obj }; delete o[col]; return o; });
    };

    const tryInsertBatch = async (batch) => {
      let attempt = 0;
      const maxAttempts = 15; // gère plusieurs colonnes manquantes
      let working = batch.map(x => ({ ...x }));
      while (attempt < maxAttempts) {
        const { error } = await supabase.from(table).insert(working, { returning: 'minimal' });
        if (!error) return; // success
        const msg = error.message || '';
        const match = msg.match(/'(.*?)' column|column\s+"(.*?)"|column\s+'(.*?)'/i);
        const col = (match && (match[1] || match[2] || match[3])) || null;
        if (col) {
          console.warn(`  ⚠️ Colonne inconnue détectée: ${col}. Suppression et nouvel essai...`);
          working = working.map(o => { const c = { ...o }; delete c[col]; return c; });
          attempt++;
          continue;
        }
        // Erreur non liée à une colonne manquante
        throw error;
      }
      throw new Error(`Échec insertion après ${maxAttempts} tentatives (colonnes manquantes multiples).`);
    };

    // Insert par batchs (100)
    const batchSize = 100;
    for (let i = 0; i < sanitized.length; i += batchSize) {
      const batch = sanitized.slice(i, i + batchSize);
      try {
        await tryInsertBatch(batch);
      } catch (error) {
        console.error(`❌ Erreur insertion ${table} batch ${i}-${i+batch.length}:`, error.message);
        process.exit(1);
      }
      console.log(`  ✓ inséré ${i + batch.length}/${sanitized.length}`);
    }
  }

  await pg.end();
  console.log('✅ Migration terminée.');
}

main().catch(e => { console.error(e); process.exit(1); });


