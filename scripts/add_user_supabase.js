// Insert a user directly into Supabase 'users' table
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env') });

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

async function main() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // Payload from request (map only likely-existing columns)
  const userData = {
    name: 'AGBANI BABATOUNDE KOTCHIKPA EPHREM CONSTANTIN',
    email: 'agbaniephrem@gmail.com',
    phone: '+22995611370',
    role: 'agent',
    departement: 'Collines',
    commune: 'Glazoué',
    arrondissement: 'Thio',
    village: 'Dokoundji',
    reference_lat: 8.0589949,
    reference_lon: 2.3231736,
    planning_start_date: '2025-02-03',
    planning_end_date: '2027-03-31',
    is_verified: true,
  };

  const plainPassword = '123456';
  const password_hash = await bcrypt.hash(plainPassword, 10);

  // Ensure not duplicated
  const { data: existing, error: existErr } = await supabase
    .from('users')
    .select('id')
    .eq('email', userData.email)
    .limit(1);
  if (existErr) {
    console.error('Failed to check existing user:', existErr.message);
    process.exit(1);
  }
  if (existing && existing.length > 0) {
    console.log('User already exists with this email:', userData.email);
    process.exit(0);
  }

  const insertPayload = {
    ...userData,
    password_hash,
  };

  const { data: inserted, error: insertErr } = await supabase
    .from('users')
    .insert([insertPayload])
    .select('id, email, name, role')
    .single();

  if (insertErr) {
    console.error('Insert error:', insertErr);
    process.exit(1);
  }

  console.log('Inserted user:', inserted);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


