const XLSX = require('xlsx');

console.log('🔍 Vérification de la structure du fichier Excel...');

try {
  const workbook = XLSX.readFile('./Data/benin_subdvision.xlsx');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convertir en JSON
  const data = XLSX.utils.sheet_to_json(worksheet);
  
  console.log(`✅ ${data.length} lignes trouvées`);
  
  if (data.length > 0) {
    console.log('📋 Colonnes disponibles:');
    const firstRow = data[0];
    Object.keys(firstRow).forEach((key, index) => {
      console.log(`   ${index + 1}. "${key}"`);
    });
    
    console.log('\n📄 Première ligne de données:');
    console.log(JSON.stringify(firstRow, null, 2));
    
    console.log('\n📄 Quelques lignes d\'exemple:');
    data.slice(0, 5).forEach((row, index) => {
      console.log(`Ligne ${index + 1}:`, JSON.stringify(row, null, 2));
    });
  }
  
} catch (error) {
  console.error('❌ Erreur:', error.message);
}
