require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

// Usage:
// node scripts/add_user_supabase_generic.js "Name" email@domain phone role departement commune arrondissement village lat lon planStart planEnd password
// Minimal required: Name, Email, Password. Others optional.

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.error('Usage: node scripts/add_user_supabase_generic.js "Name" email password [phone role departement commune arrondissement village lat lon planStart planEnd]');
    process.exit(1);
  }
  const [name, email, password,
    phone = '', role = 'agent', departement = '', commune = '', arrondissement = '', village = '',
    lat = '', lon = '', planStart = '', planEnd = ''
  ] = args;

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const password_hash = await bcrypt.hash(String(password), 10);

  const { data: existing, error: existErr } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .limit(1);
  if (existErr) throw existErr;
  if (existing && existing.length > 0) {
    console.log('User already exists:', email);
    return;
  }

  const insertPayload = {
    name,
    email,
    phone,
    role,
    departement,
    commune,
    arrondissement,
    village,
    is_verified: true,
    password_hash,
  };
  // Optional numeric and date fields if provided
  if (lat !== '') insertPayload.reference_lat = Number(lat);
  if (lon !== '') insertPayload.reference_lon = Number(lon);
  if (planStart) insertPayload.planning_start_date = planStart;
  if (planEnd) insertPayload.planning_end_date = planEnd;

  const { data: inserted, error: insertErr } = await supabase
    .from('users')
    .insert([insertPayload])
    .select('id,email,name,role')
    .single();
  if (insertErr) throw insertErr;
  console.log('Inserted user:', inserted);
}

main().catch(e => { console.error(e); process.exit(1); });


