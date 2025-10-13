require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const email = process.argv[2] || 'agbaniephrem@gmail.com';
  const role = process.argv[3] || 'supervisor';

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const { data: user, error: selErr } = await supabase.from('users').select('id, role').eq('email', email).single();
  if (selErr) {
    console.error('Select error:', selErr.message);
    process.exit(1);
  }

  const { error: updErr } = await supabase.from('users').update({ role }).eq('id', user.id);
  if (updErr) {
    console.error('Update error:', updErr.message);
    process.exit(1);
  }

  console.log(`Updated role for ${email} -> ${role}`);
}

main().catch(e => { console.error(e); process.exit(1); });


