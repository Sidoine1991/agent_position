// Supabase client singleton
const { createClient } = require('@supabase/supabase-js');

let supabase = null;
let supabaseAdmin = null;

function getSupabaseClient() {
  if (supabase) return supabase;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Supabase non configuré: veuillez définir SUPABASE_URL et SUPABASE_ANON_KEY');
  }
  supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  return supabase;
}

function getSupabaseAdmin() {
  if (supabaseAdmin) return supabaseAdmin;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) {
    throw new Error('Supabase non configuré: veuillez définir SUPABASE_URL et SUPABASE_SERVICE_ROLE');
  }
  supabaseAdmin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  return supabaseAdmin;
}

// Initialiser les clients
try {
  supabase = getSupabaseClient();
  supabaseAdmin = getSupabaseAdmin();
} catch (e) {
  console.warn('⚠️ Supabase non initialisé:', e.message);
}

module.exports = { 
  getSupabaseClient, 
  getSupabaseAdmin,
  supabase,
  supabaseAdmin
};


