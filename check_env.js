require('dotenv').config();

console.log('🔍 Variables d\'environnement Supabase:');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Défini' : '❌ Manquant');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✅ Défini' : '❌ Manquant');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Défini' : '❌ Manquant');
console.log('SUPABASE_KEY:', process.env.SUPABASE_KEY ? '✅ Défini' : '❌ Manquant');
