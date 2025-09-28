require('dotenv').config({ path: './.env' });
require('dotenv').config({ path: './web/.env', override: true });

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error('❌ Erreur: SUPABASE_URL ou SUPABASE_SERVICE_ROLE non définis.');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

async function insertInitialData() {
  console.log('🚀 Insertion des données initiales...');

  try {
    // 1. Insérer les départements du Bénin
    console.log('\n1️⃣ Insertion des départements...');
    const departements = [
      { code: 'AT', nom: 'Atacora', region: 'Nord' },
      { code: 'BO', nom: 'Borgou', region: 'Nord' },
      { code: 'AL', nom: 'Alibori', region: 'Nord' },
      { code: 'DO', nom: 'Donga', region: 'Nord' },
      { code: 'KO', nom: 'Kouffo', region: 'Sud' },
      { code: 'LI', nom: 'Littoral', region: 'Sud' },
      { code: 'MO', nom: 'Mono', region: 'Sud' },
      { code: 'OU', nom: 'Ouémé', region: 'Sud' },
      { code: 'PL', nom: 'Plateau', region: 'Sud' },
      { code: 'ZO', nom: 'Zou', region: 'Centre' },
      { code: 'CO', nom: 'Collines', region: 'Centre' },
      { code: 'BE', nom: 'Bénin' }
    ];

    for (const dept of departements) {
      const { error } = await supabaseAdmin.from('departements').upsert(dept, { onConflict: 'code' });
      if (error) throw error;
    }
    console.log('✅ Départements insérés');

    // 2. Insérer les paramètres système
    console.log('\n2️⃣ Insertion des paramètres système...');
    const systemSettings = [
      {
        category: 'general',
        key: 'organization_name',
        value: { value: 'CCRB' },
        description: 'Nom de l\'organisation',
        is_public: true
      },
      {
        category: 'general',
        key: 'timezone',
        value: { value: 'Africa/Porto-Novo' },
        description: 'Fuseau horaire par défaut',
        is_public: true
      },
      {
        category: 'work',
        key: 'work_hours',
        value: { start: '08:00', end: '17:00' },
        description: 'Heures de travail par défaut',
        is_public: true
      },
      {
        category: 'work',
        key: 'tolerance_minutes',
        value: { value: 15 },
        description: 'Tolérance de retard en minutes',
        is_public: true
      },
      {
        category: 'work',
        key: 'auto_checkout',
        value: { enabled: true },
        description: 'Déconnexion automatique en fin de journée',
        is_public: true
      },
      {
        category: 'geolocation',
        key: 'geolocation_required',
        value: { enabled: true },
        description: 'Géolocalisation obligatoire pour marquer la présence',
        is_public: true
      },
      {
        category: 'geolocation',
        key: 'default_coordinates',
        value: { latitude: 6.4969, longitude: 2.6036 },
        description: 'Coordonnées par défaut (Porto-Novo)',
        is_public: true
      },
      {
        category: 'notifications',
        key: 'email_notifications',
        value: { enabled: true },
        description: 'Notifications par email activées',
        is_public: true
      },
      {
        category: 'notifications',
        key: 'push_notifications',
        value: { enabled: true },
        description: 'Notifications push activées',
        is_public: true
      },
      {
        category: 'notifications',
        key: 'reminder_time',
        value: { time: '08:30' },
        description: 'Heure de rappel quotidien',
        is_public: true
      }
    ];

    for (const setting of systemSettings) {
      const { error } = await supabaseAdmin.from('system_settings').upsert(setting, { 
        onConflict: 'category,key' 
      });
      if (error) throw error;
    }
    console.log('✅ Paramètres système insérés');

    // 3. Insérer quelques communes principales
    console.log('\n3️⃣ Insertion des communes principales...');
    
    // Récupérer les départements insérés
    const { data: depts, error: deptsError } = await supabaseAdmin.from('departements').select('id, code');
    if (deptsError) throw deptsError;

    const communes = [
      { departement_code: 'LI', code: 'COT', nom: 'Cotonou', latitude: 6.3654, longitude: 2.4183 },
      { departement_code: 'OU', code: 'POR', nom: 'Porto-Novo', latitude: 6.4969, longitude: 2.6036 },
      { departement_code: 'PL', code: 'SAK', nom: 'Sakété', latitude: 6.7361, longitude: 2.6583 },
      { departement_code: 'ZO', code: 'ABO', nom: 'Abomey', latitude: 7.1861, longitude: 1.9911 },
      { departement_code: 'BO', code: 'PAR', nom: 'Parakou', latitude: 9.3372, longitude: 2.6303 },
      { departement_code: 'AT', code: 'NAT', nom: 'Natitingou', latitude: 10.3042, longitude: 1.3792 }
    ];

    for (const commune of communes) {
      const dept = depts.find(d => d.code === commune.departement_code);
      if (dept) {
        const { error } = await supabaseAdmin.from('communes').upsert({
          departement_id: dept.id,
          code: commune.code,
          nom: commune.nom,
          latitude: commune.latitude,
          longitude: commune.longitude
        }, { onConflict: 'code' });
        if (error) throw error;
      }
    }
    console.log('✅ Communes principales insérées');

    // 4. Créer le superadmin s'il n'existe pas
    console.log('\n4️⃣ Vérification du superadmin...');
    const { data: existingAdmin, error: adminError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', 'syebadokpo@gmail.com')
      .single();

    if (adminError && adminError.code !== 'PGRST116') {
      throw adminError;
    }

    if (!existingAdmin) {
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('123456', 10);
      
      const { error: insertError } = await supabaseAdmin.from('users').insert({
        email: 'syebadokpo@gmail.com',
        password_hash: hashedPassword,
        first_name: 'Super',
        last_name: 'Admin',
        role: 'admin',
        is_verified: true,
        phone: '+229 12 34 56 78'
      });
      
      if (insertError) throw insertError;
      console.log('✅ Superadmin créé');
    } else {
      console.log('✅ Superadmin existe déjà');
    }

    // 5. Insérer des unités administratives
    console.log('\n5️⃣ Insertion des unités administratives...');
    const adminUnits = [
      { code: 'CCRB', nom: 'Centre Communal de Référence de Base', type: 'organization', description: 'Organisation principale' },
      { code: 'ADMIN', nom: 'Administration', type: 'department', description: 'Département administratif' },
      { code: 'FIELD', nom: 'Terrain', type: 'department', description: 'Département terrain' },
      { code: 'SUPPORT', nom: 'Support', type: 'department', description: 'Département support' }
    ];

    for (const unit of adminUnits) {
      const { error } = await supabaseAdmin.from('admin_units').upsert(unit, { onConflict: 'code' });
      if (error) throw error;
    }
    console.log('✅ Unités administratives insérées');

    console.log('\n🎉 Données initiales insérées avec succès!');
    console.log('\n📋 Prochaines étapes:');
    console.log('1. Vérifiez les données dans Supabase Dashboard');
    console.log('2. Testez l\'application avec les nouvelles données');
    console.log('3. Déployez sur Vercel/Render');

  } catch (error) {
    console.error('❌ Erreur lors de l\'insertion des données:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

insertInitialData();
