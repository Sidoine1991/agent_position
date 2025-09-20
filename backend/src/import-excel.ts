import * as XLSX from 'xlsx';
import { db, migrate } from './db.js';

interface ExcelRow {
  [key: string]: string | number;
}

function readExcelFile(filePath: string): ExcelRow[] {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet);
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

async function importGeoData() {
  try {
    // Ensure database is migrated
    migrate();
    
    const filePath = '../Data/benin_subdvision.xlsx';
    console.log('Reading Excel file:', filePath);
    
    const rows = readExcelFile(filePath);
    console.log(`Found ${rows.length} rows`);
    
    if (rows.length === 0) {
      console.log('No data found in Excel file');
      return;
    }

    // Get column names from first row
    const firstRow = rows[0];
    const columns = Object.keys(firstRow);
    console.log('Columns found:', columns);

    // Try to identify the correct column names (case insensitive)
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

    const departementCol = findColumn(['departement', 'département', 'department']);
    const communeCol = findColumn(['commune', 'municipality']);
    const arrondissementCol = findColumn(['arrondissement', 'arrond', 'district']);
    const villageCol = findColumn(['village', 'village', 'localite', 'localité']);

    console.log('Identified columns:', {
      departement: departementCol,
      commune: communeCol,
      arrondissement: arrondissementCol,
      village: villageCol
    });

    if (!departementCol || !communeCol) {
      console.error('Could not identify required columns (departement, commune)');
      return;
    }

    const tx = db.transaction(() => {
      // Clear existing data
      db.prepare('DELETE FROM villages').run();
      db.prepare('DELETE FROM arrondissements').run();
      db.prepare('DELETE FROM communes').run();
      db.prepare('DELETE FROM departements').run();

      const departements = new Map<string, number>();
      const communes = new Map<string, number>();
      const arrondissements = new Map<string, number>();

      for (const row of rows) {
        const departementName = normalizeName(String(row[departementCol] || ''));
        const communeName = normalizeName(String(row[communeCol] || ''));
        const arrondissementName = arrondissementCol ? normalizeName(String(row[arrondissementCol] || '')) : '';
        const villageName = villageCol ? normalizeName(String(row[villageCol] || '')) : '';

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
          }
        }
      }

      console.log(`Imported ${departements.size} departements`);
      console.log(`Imported ${communes.size} communes`);
      console.log(`Imported ${arrondissements.size} arrondissements`);
    });

    tx();
    console.log('Import completed successfully');
  } catch (error) {
    console.error('Import failed:', error);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  importGeoData().then(() => process.exit(0)).catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
}

export { importGeoData };
