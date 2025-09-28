// Migration Render Postgres -> Supabase
// Usage: node scripts/migrate-to-supabase.js
// Required env: DATABASE_URL (Render), SUPABASE_URL, SUPABASE_SERVICE_ROLE

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

    // Supprime les ids auto si collision possible (Supabase gère identity)
    const sanitized = rows.map(r => {
      const copy = { ...r };
      // Dates en ISO string
      Object.keys(copy).forEach(k => {
        if (copy[k] instanceof Date) copy[k] = copy[k].toISOString();
      });
      return copy;
    });

    // Insert par batchs (100)
    const batchSize = 100;
    for (let i = 0; i < sanitized.length; i += batchSize) {
      const batch = sanitized.slice(i, i + batchSize);
      const { error } = await supabase.from(table).insert(batch, { returning: 'minimal' });
      if (error) {
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


