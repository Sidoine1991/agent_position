const Database = require('better-sqlite3');
const path = require('path');
const XLSX = require('xlsx');

// Initialize database
const dataDir = path.join(process.cwd(), '..', 'backend', 'data');
const dbFile = path.join(dataDir, 'app.db');
const db = new Database(dbFile);

// Ensure data directory exists
const fs = require('fs');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

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
`);

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Check if data already exists
    const existingCount = db.prepare('SELECT COUNT(*) as count FROM departements').get();
    if (existingCount.count > 0) {
      return res.json({ message: 'Geographic data already initialized', count: existingCount.count });
    }

    // Import data from Excel file
    const filePath = path.join(process.cwd(), '..', 'Data', 'benin_subdvision.xlsx');
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Excel file not found' });
    }

    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet);

    if (rows.length === 0) {
      return res.status(400).json({ error: 'No data found in Excel file' });
    }

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

    // Process each type
    for (const [listName, typeRows] of Object.entries(groupedRows)) {
      console.log(`Processing ${listName}: ${typeRows.length} rows`);
      
      for (const row of typeRows) {
        const name = String(row.name || '').trim();
        if (!name) continue;

        if (listName === 'Département') {
          if (!departements.has(name)) {
            const info = db.prepare('INSERT INTO departements (name) VALUES (?)').run(name);
            departements.set(name, info.lastInsertRowid);
            importedCount++;
          }
        } else if (listName === 'Commune') {
          const parentName = String(row.parent_name || '').trim();
          if (parentName && departements.has(parentName)) {
            const departementId = departements.get(parentName);
            const communeKey = `${departementId}-${name}`;
            if (!communes.has(communeKey)) {
              const info = db.prepare('INSERT INTO communes (departement_id, name) VALUES (?, ?)').run(departementId, name);
              communes.set(communeKey, info.lastInsertRowid);
              importedCount++;
            }
          }
        } else if (listName === 'Arrondissement') {
          const parentName = String(row.parent_name || '').trim();
          if (parentName) {
            // Find commune by name
            for (const [communeKey, communeId] of communes) {
              const communeName = communeKey.split('-')[1];
              if (communeName === parentName) {
                const arrondissementKey = `${communeId}-${name}`;
                if (!arrondissements.has(arrondissementKey)) {
                  const info = db.prepare('INSERT INTO arrondissements (commune_id, name) VALUES (?, ?)').run(communeId, name);
                  arrondissements.set(arrondissementKey, info.lastInsertRowid);
                  importedCount++;
                }
                break;
              }
            }
          }
        } else if (listName === 'Village') {
          const parentName = String(row.parent_name || '').trim();
          if (parentName) {
            // Find arrondissement by name
            for (const [arrondissementKey, arrondissementId] of arrondissements) {
              const arrondissementName = arrondissementKey.split('-')[1];
              if (arrondissementName === parentName) {
                const info = db.prepare('INSERT INTO villages (arrondissement_id, name) VALUES (?, ?)').run(arrondissementId, name);
                importedCount++;
                break;
              }
            }
          }
        }
      }
    }

    res.json({ 
      message: 'Geographic data initialized successfully', 
      importedCount,
      departements: departements.size,
      communes: communes.size,
      arrondissements: arrondissements.size
    });

  } catch (error) {
    console.error('Error initializing geographic data:', error);
    res.status(500).json({ error: 'Internal server error: ' + error.message });
  }
};
