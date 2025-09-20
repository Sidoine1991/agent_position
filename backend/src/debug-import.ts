import * as XLSX from 'xlsx';
import { db, migrate } from './db.js';

async function debugImport() {
  try {
    console.log('Starting debug import...');
    
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
    
    if (rows.length > 0) {
      console.log('First row:', rows[0]);
      console.log('Columns:', Object.keys(rows[0]));
    }
    
    console.log('Debug completed successfully');
  } catch (error) {
    console.error('Debug failed:', error);
    console.error('Stack:', error.stack);
  }
}

debugImport().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
