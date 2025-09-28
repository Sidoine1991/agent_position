// Utility to preview and clean PostgreSQL database tables safely
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

function getArg(flag, defaultValue = undefined) {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  return defaultValue;
}

const databaseUrl = process.env.DATABASE_URL || getArg('--url');
if (!databaseUrl) {
  console.error('DATABASE_URL not provided. Pass via env or --url');
  process.exit(1);
}

const action = getArg('--action', 'preview'); // preview | purge-all | cleanup-users | create-super-admin | migrate-absences | migrate-core | migrate-user-profile | migrate-extra | preview-tables
const keepEmail = getArg('--keep-email', process.env.SUPERADMIN_EMAIL || 'syebadokpo@gmail.com');
const superAdminEmail = getArg('--email', process.env.SUPERADMIN_EMAIL || 'syebadokpo@gmail.com');
const superAdminPassword = getArg('--password', process.env.SUPERADMIN_PASSWORD || '123456');

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : { rejectUnauthorized: false }
});

async function getTableCounts(client) {
  const tables = [
    'verification_codes',
    'checkins',
    'missions',
    'absences',
    'reports',
    'users'
  ];
  const counts = {};
  for (const table of tables) {
    try {
      const res = await client.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
      counts[table] = res.rows[0].count;
    } catch (e) {
      counts[table] = `ERR: ${e.message}`;
    }
  }
  return counts;
}

async function preview() {
  const client = await pool.connect();
  try {
    const counts = await getTableCounts(client);
    console.log('Row counts per table:', counts);
  } finally {
    client.release();
  }
}

async function purgeAll() {
  const client = await pool.connect();
  try {
    // No single transaction to avoid getting stuck on one error
    const before = await getTableCounts(client);
    const existingRes = await client.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`);
    const existing = new Set(existingRes.rows.map(r => r.tablename));

    const ordered = ['checkins','missions','absences','reports','verification_codes','users'];
    for (const table of ordered) {
      if (!existing.has(table)) continue;
      try {
        await client.query(`DELETE FROM ${table}`);
      } catch (e) {
        console.warn(`DELETE failed on ${table}: ${e.message}`);
      }
    }

    for (const table of ordered) {
      if (!existing.has(table)) continue;
      try {
        const seqRes = await client.query(`SELECT pg_get_serial_sequence($1, 'id') AS seq`, [table]);
        const seq = seqRes.rows[0]?.seq;
        if (seq) {
          await client.query(`ALTER SEQUENCE ${seq} RESTART WITH 1`);
        }
      } catch (e) {
        console.warn(`Sequence reset skipped for ${table}: ${e.message}`);
      }
    }

    const after = await getTableCounts(client);
    console.log('Before:', before);
    console.log('After:', after);
  } catch (e) {
    console.error('Purge failed:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

async function migrateCore() {
  const client = await pool.connect();
  try {
    const sql = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('admin','superviseur','agent')),
        phone VARCHAR(20),
        is_verified BOOLEAN DEFAULT FALSE,
        verification_code VARCHAR(6),
        verification_expires TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS verification_codes (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        code VARCHAR(6) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS presences (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        location_lat DECIMAL(10,8),
        location_lng DECIMAL(11,8),
        location_name VARCHAR(255),
        notes TEXT,
        photo_url VARCHAR(500),
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS missions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        start_lat DECIMAL(10,8),
        start_lon DECIMAL(11,8),
        end_lat DECIMAL(10,8),
        end_lon DECIMAL(11,8),
        departement VARCHAR(100),
        commune VARCHAR(100),
        arrondissement VARCHAR(100),
        village VARCHAR(100),
        note TEXT,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS checkins (
        id SERIAL PRIMARY KEY,
        mission_id INTEGER REFERENCES missions(id),
        lat DECIMAL(10,8),
        lon DECIMAL(11,8),
        note TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        title VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        content TEXT,
        data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_presences_user_id ON presences(user_id);
      CREATE INDEX IF NOT EXISTS idx_presences_start_time ON presences(start_time);
      CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
      CREATE INDEX IF NOT EXISTS idx_verification_codes_email ON verification_codes(email);
    `;
    await client.query(sql);
    console.log('Core tables migrated/ensured.');
  } catch (e) {
    console.error('Migrate core failed:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

async function migrateUserProfile() {
  const client = await pool.connect();
  try {
    // Add optional profile fields if missing
    const alters = [
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100)",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100)",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_path VARCHAR(500)",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS project_name VARCHAR(255)",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS project_description TEXT",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS planning_start_date DATE",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS planning_end_date DATE",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS expected_days_per_month INTEGER",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS expected_hours_per_month INTEGER",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS work_schedule JSONB",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS contract_type VARCHAR(100)",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS departement VARCHAR(100)",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS commune VARCHAR(100)",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS arrondissement VARCHAR(100)",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS village VARCHAR(100)",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS village_id INTEGER",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS tolerance_radius_meters INTEGER",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS reference_lat DECIMAL(10,8)",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS reference_lon DECIMAL(11,8)",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS gps_accuracy INTEGER"
    ];
    for (const sql of alters) {
      await client.query(sql);
    }
    console.log('User profile columns migrated/ensured.');
  } catch (e) {
    console.error('Migrate user profile failed:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

async function migrateExtra() {
  const client = await pool.connect();
  try {
    const sql = `
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT
      );
      CREATE TABLE IF NOT EXISTS permissions (
        id SERIAL PRIMARY KEY,
        code VARCHAR(150) UNIQUE NOT NULL,
        description TEXT
      );
      CREATE TABLE IF NOT EXISTS user_roles (
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, role_id)
      );
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
        permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
        PRIMARY KEY (role_id, permission_id)
      );
      CREATE TABLE IF NOT EXISTS permission_assignments (
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, permission_id)
      );
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        action VARCHAR(150) NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS app_settings (
        key VARCHAR(150) PRIMARY KEY,
        value JSONB,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
    `;
    await client.query(sql);
    // seed minimal roles/permissions
    await client.query(`INSERT INTO roles (name, description) VALUES
      ('admin','Administrateur'),
      ('superviseur','Superviseur'),
      ('agent','Agent')
      ON CONFLICT (name) DO NOTHING`);
    await client.query(`INSERT INTO permissions (code, description) VALUES
      ('users.manage','Gérer les utilisateurs'),
      ('missions.manage','Gérer les missions'),
      ('reports.view','Voir les rapports')
      ON CONFLICT (code) DO NOTHING`);
    console.log('Extra tables (roles/permissions, audit, settings) migrated/ensured.');
  } catch (e) {
    console.error('Migrate extra failed:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

async function listTables() {
  const client = await pool.connect();
  try {
    const res = await client.query(`SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`);
    console.log('Public tables:', res.rows.map(r => r.tablename));
  } finally {
    client.release();
  }
}

async function configureDefaults() {
  const client = await pool.connect();
  try {
    // Ensure admin role exists and assign to super admin
    const roleRes = await client.query(`INSERT INTO roles (name, description) VALUES ('admin','Administrateur') ON CONFLICT (name) DO NOTHING RETURNING id`);
    const roleIdRow = roleRes.rows[0] || (await client.query(`SELECT id FROM roles WHERE name = 'admin' LIMIT 1`)).rows[0];
    const roleId = roleIdRow?.id;

    const userRow = (await client.query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`, [superAdminEmail])).rows[0];
    if (roleId && userRow?.id) {
      await client.query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [userRow.id, roleId]);
    }

    // Seed default app settings using parameterized jsonb values
    const settings = [
      ['presence.expected_days_per_month', 22],
      ['presence.expected_hours_per_month', 176],
      ['geo.default_departement', 'Littoral'],
      ['security.password_min_length', 6]
    ];
    for (const [key, value] of settings) {
      await client.query(
        `INSERT INTO app_settings (key, value, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, JSON.stringify(value)]
      );
    }

    console.log('Defaults configured: admin role assigned and app_settings seeded.');
  } catch (e) {
    console.error('Configure defaults failed:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

async function cleanupUsers() {
  const client = await pool.connect();
  try {
    const keepRes = await client.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [keepEmail]);
    if (keepRes.rows.length === 0) {
      console.error(`Account to keep not found: ${keepEmail}`);
      process.exit(2);
    }
    const keepUserId = keepRes.rows[0].id;

    await client.query('BEGIN');
    const before = await getTableCounts(client);

    const usersToDelete = await client.query('SELECT id, email FROM users WHERE id <> $1', [keepUserId]);
    const ids = usersToDelete.rows.map(r => r.id);
    if (ids.length > 0) {
      const missionIdsRes = await client.query('SELECT id FROM missions WHERE user_id = ANY($1::int[])', [ids]);
      const missionIds = missionIdsRes.rows.map(r => r.id);
      if (missionIds.length > 0) {
        await client.query('DELETE FROM checkins WHERE mission_id = ANY($1::int[])', [missionIds]);
      }
      await client.query('DELETE FROM missions WHERE user_id = ANY($1::int[])', [ids]);
      await client.query('DELETE FROM absences WHERE user_id = ANY($1::int[])', [ids]);
      await client.query('DELETE FROM reports WHERE user_id = ANY($1::int[])', [ids]);
      const emails = usersToDelete.rows.map(r => r.email.toLowerCase());
      if (emails.length > 0) {
        await client.query('DELETE FROM verification_codes WHERE LOWER(email) = ANY($1::text[])', [emails]);
      }
      await client.query('DELETE FROM users WHERE id = ANY($1::int[])', [ids]);
    }

    await client.query('COMMIT');
    const after = await getTableCounts(client);
    console.log('Kept:', keepEmail);
    console.log('Before:', before);
    console.log('After:', after);
  } catch (e) {
    try { await pool.query('ROLLBACK'); } catch {}
    console.error('Cleanup-users failed:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

(async function migrateAbsences() {
  // placeholder to satisfy linter in case function is hoisted later
})();

async function createSuperAdmin() {
  const client = await pool.connect();
  try {
    const exists = await client.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [superAdminEmail]);
    if (exists.rows.length > 0) {
      console.log(`Super admin already exists: ${superAdminEmail}`);
      return;
    }
    const passwordHash = await bcrypt.hash(superAdminPassword, 10);
    await client.query(
      `INSERT INTO users (email, password_hash, name, role, phone, is_verified)
       VALUES ($1, $2, $3, $4, $5, TRUE)`,
      [superAdminEmail, passwordHash, 'Admin Principal', 'admin', '+229 12345678']
    );
    console.log(`Super admin created: ${superAdminEmail}`);
  } catch (e) {
    console.error('Create super admin failed:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

async function migrateAbsences() {
  const client = await pool.connect();
  try {
    const sql = `
      CREATE TABLE IF NOT EXISTS absences (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        date DATE NOT NULL,
        reason VARCHAR(255) DEFAULT 'Non marquage de présence avant 18h',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, date)
      );
      CREATE INDEX IF NOT EXISTS idx_absences_user_date ON absences(user_id, date);
      CREATE INDEX IF NOT EXISTS idx_absences_date ON absences(date);
    `;
    await client.query(sql);
    console.log('Absences table migrated/ensured.');
  } catch (e) {
    console.error('Migrate absences failed:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

(async function run() {
  if (action === 'preview') {
    await preview();
  } else if (action === 'purge-all') {
    await purgeAll();
  } else if (action === 'cleanup-users') {
    await cleanupUsers();
  } else if (action === 'create-super-admin') {
    await createSuperAdmin();
  } else if (action === 'migrate-core') {
    await migrateCore();
  } else if (action === 'migrate-absences') {
    await migrateAbsences();
  } else if (action === 'migrate-user-profile') {
    await migrateUserProfile();
  } else if (action === 'migrate-extra') {
    await migrateExtra();
  } else if (action === 'preview-tables') {
    await listTables();
  } else if (action === 'configure-defaults') {
    await configureDefaults();
  } else {
    console.error(`Unknown --action ${action}`);
    process.exit(1);
  }
  await pool.end();
})();


