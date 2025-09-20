const XLSX = require('xlsx');
const path = require('path');

// Lire le fichier Excel
const filePath = path.join(__dirname, 'Data', 'benin_subdvision.xlsx');
console.log('Reading Excel file:', filePath);

const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(worksheet);

console.log(`Found ${rows.length} rows`);

// Grouper par list_name
const groupedRows = {};
for (const row of rows) {
  const listName = row.list_name;
  if (!groupedRows[listName]) {
    groupedRows[listName] = [];
  }
  groupedRows[listName].push(row);
}

console.log('Found data types:', Object.keys(groupedRows));

// Construire la hiérarchie complète
const hierarchy = {
  departements: [],
  communes: {},
  arrondissements: {},
  villages: {}
};

// 1. Départements
if (groupedRows.depart) {
  hierarchy.departements = groupedRows.depart.map((row, index) => ({
    id: index + 1,
    name: String(row.name || '').trim()
  })).filter(d => d.name);
}

// 2. Communes par département
if (groupedRows.comm) {
  for (const row of groupedRows.comm) {
    const name = String(row.name || '').trim();
    const parent = String(row.admin || '').trim();
    if (name && parent) {
      if (!hierarchy.communes[parent]) {
        hierarchy.communes[parent] = [];
      }
      hierarchy.communes[parent].push({
        id: hierarchy.communes[parent].length + 1,
        name: name
      });
    }
  }
}

// 3. Arrondissements par commune
if (groupedRows.arrond) {
  for (const row of groupedRows.arrond) {
    const name = String(row.name || '').trim();
    const parent = String(row.admin || '').trim();
    if (name && parent) {
      if (!hierarchy.arrondissements[parent]) {
        hierarchy.arrondissements[parent] = [];
      }
      hierarchy.arrondissements[parent].push({
        id: hierarchy.arrondissements[parent].length + 1,
        name: name
      });
    }
  }
}

// 4. Villages par arrondissement
if (groupedRows.villag) {
  for (const row of groupedRows.villag) {
    const name = String(row.name || '').trim();
    const parent = String(row.admin || '').trim();
    if (name && parent) {
      if (!hierarchy.villages[parent]) {
        hierarchy.villages[parent] = [];
      }
      hierarchy.villages[parent].push({
        id: hierarchy.villages[parent].length + 1,
        name: name
      });
    }
  }
}

console.log('\n=== HIERARCHY SUMMARY ===');
console.log('Départements:', hierarchy.departements.length);
console.log('Communes par département:', Object.keys(hierarchy.communes).length);
console.log('Arrondissements par commune:', Object.keys(hierarchy.arrondissements).length);
console.log('Villages par arrondissement:', Object.keys(hierarchy.villages).length);

// Afficher quelques exemples
console.log('\n=== EXEMPLES ===');
console.log('Départements:', hierarchy.departements.slice(0, 3));
console.log('Communes d\'Alibori:', hierarchy.communes['Alibori']?.slice(0, 3));
console.log('Arrondissements de Banikoara:', hierarchy.arrondissements['Banikoara']?.slice(0, 3));
console.log('Villages d\'un arrondissement:', Object.values(hierarchy.villages)[0]?.slice(0, 3));

// Exporter en JSON
const fs = require('fs');
fs.writeFileSync('hierarchy-data-fixed.json', JSON.stringify(hierarchy, null, 2));
console.log('\nData exported to hierarchy-data-fixed.json');
