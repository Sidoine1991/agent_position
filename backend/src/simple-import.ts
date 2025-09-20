import * as XLSX from 'xlsx';
import { db, migrate } from './db.js';

async function simpleImport() {
  try {
    console.log('Starting simple import...');
    
    // Ensure database is migrated
    migrate();
    console.log('Database migrated');
    
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
      return;
    }

    // Show first few rows to understand structure
    console.log('First 3 rows:');
    for (let i = 0; i < Math.min(3, rows.length); i++) {
      console.log(`Row ${i + 1}:`, rows[i]);
    }

    // Get column names
    const firstRow = rows[0];
    const columns = Object.keys(firstRow);
    console.log('Available columns:', columns);

    // Try to find the right columns
    const findColumn = (patterns: string[]): string | null => {
      for (const pattern of patterns) {
        const col = columns.find(c => 
          c.toLowerCase().includes(pattern.toLowerCase()) ||
          pattern.toLowerCase().includes(c.toLowerCase())
        );
        if (col) return col;
      }
      return null;
    };

    const departementCol = findColumn(['departement', 'département', 'department', 'dept']);
    const communeCol = findColumn(['commune', 'municipality', 'municipalite']);
    const arrondissementCol = findColumn(['arrondissement', 'arrond', 'district', 'arr']);
    const villageCol = findColumn(['village', 'localite', 'localité', 'ville']);

    console.log('Identified columns:', {
      departement: departementCol,
      commune: communeCol,
      arrondissement: arrondissementCol,
      village: villageCol
    });

    if (!departementCol || !communeCol) {
      console.error('Could not identify required columns (departement, commune)');
      console.log('Available columns:', columns);
      return;
    }

    // Clear existing data
    db.prepare('DELETE FROM villages').run();
    db.prepare('DELETE FROM arrondissements').run();
    db.prepare('DELETE FROM communes').run();
    db.prepare('DELETE FROM departements').run();

    const departements = new Map<string, number>();
    const communes = new Map<string, number>();
    const arrondissements = new Map<string, number>();

    let importedCount = 0;

    for (const row of rows) {
      const departementName = String(row[departementCol] || '').trim();
      const communeName = String(row[communeCol] || '').trim();
      const arrondissementName = arrondissementCol ? String(row[arrondissementCol] || '').trim() : '';
      const villageName = villageCol ? String(row[villageCol] || '').trim() : '';

      if (!departementName || !communeName) continue;

      // Insert departement
      if (!departements.has(departementName)) {
        const info = db.prepare('INSERT INTO departements (name) VALUES (?)').run(departementName);
        departements.set(departementName, info.lastInsertRowid as number);
      }
      const departementId = departements.get(departementName)!;

      // Insert commune
      const communeKey = `${departementId}-${communeName}`;
      if (!communes.has(communeKey)) {
        const info = db.prepare('INSERT INTO communes (departement_id, name) VALUES (?, ?)').run(departementId, communeName);
        communes.set(communeKey, info.lastInsertRowid as number);
      }
      const communeId = communes.get(communeKey)!;

      // Insert arrondissement if column exists
      if (arrondissementName) {
        const arrondissementKey = `${communeId}-${arrondissementName}`;
        if (!arrondissements.has(arrondissementKey)) {
          const info = db.prepare('INSERT INTO arrondissements (commune_id, name) VALUES (?, ?)').run(communeId, arrondissementName);
          arrondissements.set(arrondissementKey, info.lastInsertRowid as number);
        }
        const arrondissementId = arrondissements.get(arrondissementKey)!;

        // Insert village if column exists
        if (villageName) {
          db.prepare('INSERT INTO villages (arrondissement_id, name) VALUES (?, ?)').run(arrondissementId, villageName);
          importedCount++;
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
    console.error('Stack:', error.stack);
  }
}

simpleImport().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
