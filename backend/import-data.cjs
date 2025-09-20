const XLSX = require('xlsx');
const Database = require('better-sqlite3');
const path = require('path');

// Initialize database
const dataDir = path.join(process.cwd(), 'data');
const dbFile = path.join(dataDir, 'app.db');
const db = new Database(dbFile);

// Migrate database
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  
  -- Geo hierarchy
  CREATE TABLE IF NOT EXISTS departements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );
  CREATE TABLE IF NOT EXISTS communes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    departement_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    UNIQUE(departement_id, name),
    FOREIGN KEY(departement_id) REFERENCES departements(id)
  );
  CREATE TABLE IF NOT EXISTS arrondissements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    commune_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    UNIQUE(commune_id, name),
    FOREIGN KEY(commune_id) REFERENCES communes(id)
  );
  CREATE TABLE IF NOT EXISTS villages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    arrondissement_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    UNIQUE(arrondissement_id, name),
    FOREIGN KEY(arrondissement_id) REFERENCES arrondissements(id)
  );
  
  -- Users
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'agent',
    consent_signed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  
  -- Missions
  CREATE TABLE IF NOT EXISTS missions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id INTEGER NOT NULL,
    date_start TEXT NOT NULL,
    date_end TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    village_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(agent_id) REFERENCES users(id),
    FOREIGN KEY(village_id) REFERENCES villages(id)
  );
  
  -- Checkins
  CREATE TABLE IF NOT EXISTS checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mission_id INTEGER NOT NULL,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    photo_path TEXT,
    note TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(mission_id) REFERENCES missions(id)
  );
  
  -- Audit logs
  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    details TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

console.log('Database migrated');

// Create admin user
const bcrypt = require('bcryptjs');
const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@example.com');
if (!adminExists) {
  const passwordHash = bcrypt.hashSync('Admin@123', 10);
  db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
    .run('Admin', 'admin@example.com', passwordHash, 'admin');
  console.log('Admin user created');
}

// Import Excel data
try {
  const filePath = '../Data/benin_subdvision.xlsx';
  console.log('Reading Excel file:', filePath);
  
  const workbook = XLSX.readFile(filePath);
  console.log('Workbook sheets:', workbook.SheetNames);
  
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet);
  
  console.log(`Found ${rows.length} rows`);
  
  if (rows.length === 0) {
    console.log('No data found in Excel file');
    process.exit(0);
  }

  // Show first few rows
  console.log('First 3 rows:');
  for (let i = 0; i < Math.min(3, rows.length); i++) {
    console.log(`Row ${i + 1}:`, rows[i]);
  }

  // Get column names
  const firstRow = rows[0];
  const columns = Object.keys(firstRow);
  console.log('Available columns:', columns);

  // This Excel file has a hierarchical structure with list_name indicating the type
  // We need to process rows by their list_name to build the hierarchy
  console.log('Processing hierarchical data...');

  // Clear existing data
  db.prepare('DELETE FROM villages').run();
  db.prepare('DELETE FROM arrondissements').run();
  db.prepare('DELETE FROM communes').run();
  db.prepare('DELETE FROM departements').run();

  const departements = new Map();
  const communes = new Map();
  const arrondissements = new Map();

  let importedCount = 0;

  // Group rows by list_name
  const groupedRows = {};
  for (const row of rows) {
    const listName = row.list_name;
    if (!groupedRows[listName]) {
      groupedRows[listName] = [];
    }
    groupedRows[listName].push(row);
  }

  console.log('Found data types:', Object.keys(groupedRows));
  
  // Show sample data for each type
  for (const [type, data] of Object.entries(groupedRows)) {
    console.log(`\nSample ${type} data:`, data.slice(0, 3));
  }

  // Process departements first
  if (groupedRows.depart) {
    console.log(`Processing ${groupedRows.depart.length} departements...`);
    for (const row of groupedRows.depart) {
      const name = String(row.name || '').trim();
      if (name) {
        const info = db.prepare('INSERT INTO departements (name) VALUES (?)').run(name);
        departements.set(name, info.lastInsertRowid);
      }
    }
  }

  // Process communes
  if (groupedRows.comm) {
    console.log(`Processing ${groupedRows.comm.length} communes...`);
    for (const row of groupedRows.comm) {
      const name = String(row.name || '').trim();
      const parent = String(row.admin || '').trim();
      if (name && parent) {
        // Find parent departement
        const departementId = departements.get(parent);
        if (departementId) {
          const communeKey = `${departementId}-${name}`;
          if (!communes.has(communeKey)) {
            const info = db.prepare('INSERT INTO communes (departement_id, name) VALUES (?, ?)').run(departementId, name);
            communes.set(communeKey, info.lastInsertRowid);
          }
        }
      }
    }
  }

  // Process arrondissements
  if (groupedRows.arrond) {
    console.log(`Processing ${groupedRows.arrond.length} arrondissements...`);
    for (const row of groupedRows.arrond) {
      const name = String(row.name || '').trim();
      const parent = String(row.admin || '').trim();
      if (name && parent) {
        // Find parent commune
        for (const [communeKey, communeId] of communes) {
          if (communeKey.includes(parent)) {
            const arrondissementKey = `${communeId}-${name}`;
            if (!arrondissements.has(arrondissementKey)) {
              const info = db.prepare('INSERT INTO arrondissements (commune_id, name) VALUES (?, ?)').run(communeId, name);
              arrondissements.set(arrondissementKey, info.lastInsertRowid);
            }
            break;
          }
        }
      }
    }
  }

  // Process villages
  if (groupedRows.villag) {
    console.log(`Processing ${groupedRows.villag.length} villages...`);
    for (const row of groupedRows.villag) {
      const name = String(row.name || '').trim();
      const parent = String(row.admin || '').trim();
      if (name && parent) {
        // Find parent arrondissement
        for (const [arrondissementKey, arrondissementId] of arrondissements) {
          if (arrondissementKey.includes(parent)) {
            db.prepare('INSERT INTO villages (arrondissement_id, name) VALUES (?, ?)').run(arrondissementId, name);
            importedCount++;
            break;
          }
        }
      }
    }
  }

  console.log(`Import completed successfully!`);
  console.log(`- ${departements.size} departements`);
  console.log(`- ${communes.size} communes`);
  console.log(`- ${arrondissements.size} arrondissements`);
  console.log(`- ${importedCount} villages`);

} catch (error) {
  console.error('Import failed:', error);
  process.exit(1);
}

db.close();
process.exit(0);
