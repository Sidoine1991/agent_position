const XLSX = require('xlsx');

console.log('🔍 Vérification des types de données...');

try {
  const workbook = XLSX.readFile('./Data/benin_subdvision.xlsx');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  const data = XLSX.utils.sheet_to_json(worksheet);
  
  // Compter les types
  const types = {};
  data.forEach(row => {
    const type = row.list_name;
    if (type) {
      types[type] = (types[type] || 0) + 1;
    }
  });
  
  console.log('📊 Types de données trouvés:');
  Object.entries(types).forEach(([type, count]) => {
    console.log(`   - ${type}: ${count} entrées`);
  });
  
  // Afficher quelques exemples de chaque type
  Object.keys(types).forEach(type => {
    const examples = data.filter(row => row.list_name === type).slice(0, 3);
    console.log(`\n📋 Exemples de "${type}":`);
    examples.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.name}`);
    });
  });
  
} catch (error) {
  console.error('❌ Erreur:', error.message);
}
