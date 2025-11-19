console.log('🔍 Test de parsing des dates...');

const testDate = '2025-11-18';
console.log('Date string:', testDate);

const fromDate = new Date(testDate);
console.log('new Date("2025-11-18"):', fromDate.toISOString());
console.log('Timezone offset:', fromDate.getTimezoneOffset());

const fromDateUTC = new Date(testDate + 'T00:00:00.000Z');
console.log('new Date("2025-11-18T00:00:00.000Z"):', fromDateUTC.toISOString());

const toDate = new Date(testDate + 'T23:59:59.999Z');
console.log('new Date("2025-11-18T23:59:59.999Z"):', toDate.toISOString());

// Test avec une validation réelle
const validationDate = '2025-11-18T05:59:23.643+00:00';
const timestamp = new Date(validationDate);
console.log('\nValidation date:', validationDate);
console.log('Validation timestamp:', timestamp.toISOString());

// Test de comparaison
console.log('\nComparaison avec parsing local:');
const inRangeLocal = timestamp >= fromDate && timestamp <= toDate;
console.log('In range (local parsing):', inRangeLocal);

console.log('\nComparaison avec parsing UTC:');
const inRangeUTC = timestamp >= fromDateUTC && timestamp <= toDate;
console.log('In range (UTC parsing):', inRangeUTC);

// Solution: utiliser UTC
console.log('\n✅ Solution - parsing UTC:');
const fromDateSolution = new Date(testDate + 'T00:00:00.000Z');
const toDateSolution = new Date(testDate + 'T23:59:59.999Z');
const inRangeSolution = timestamp >= fromDateSolution && timestamp <= toDateSolution;
console.log('From UTC:', fromDateSolution.toISOString());
console.log('To UTC:', toDateSolution.toISOString());
console.log('In range (solution):', inRangeSolution);
