// Supabase client singleton
const { createClient } = require('@supabase/supabase-js');

let supabase = null;

function getSupabaseClient() {
  if (supabase) return supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Supabase non configuré: veuillez définir SUPABASE_URL et SUPABASE_SERVICE_ROLE/ANON_KEY');
  }
  supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  return supabase;
}

module.exports = { getSupabaseClient };


