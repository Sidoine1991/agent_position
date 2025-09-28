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

async function createTablesIndividually() {
  console.log('🚀 Création des tables une par une...');

  const tables = [
    {
      name: 'departements',
      sql: `
        CREATE TABLE IF NOT EXISTS departements (
          id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          code VARCHAR(10) UNIQUE NOT NULL,
          nom VARCHAR(100) NOT NULL,
          region VARCHAR(100),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    },
    {
      name: 'communes',
      sql: `
        CREATE TABLE IF NOT EXISTS communes (
          id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          departement_id BIGINT REFERENCES departements(id) ON DELETE CASCADE,
          code VARCHAR(10) NOT NULL,
          nom VARCHAR(100) NOT NULL,
          latitude DECIMAL(10, 8),
          longitude DECIMAL(11, 8),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    },
    {
      name: 'arrondissements',
      sql: `
        CREATE TABLE IF NOT EXISTS arrondissements (
          id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          commune_id BIGINT REFERENCES communes(id) ON DELETE CASCADE,
          code VARCHAR(10) NOT NULL,
          nom VARCHAR(100) NOT NULL,
          latitude DECIMAL(10, 8),
          longitude DECIMAL(11, 8),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    },
    {
      name: 'villages',
      sql: `
        CREATE TABLE IF NOT EXISTS villages (
          id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          arrondissement_id BIGINT REFERENCES arrondissements(id) ON DELETE CASCADE,
          code VARCHAR(10) NOT NULL,
          nom VARCHAR(100) NOT NULL,
          latitude DECIMAL(10, 8),
          longitude DECIMAL(11, 8),
          population INTEGER,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    },
    {
      name: 'admin_units',
      sql: `
        CREATE TABLE IF NOT EXISTS admin_units (
          id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          code VARCHAR(20) UNIQUE NOT NULL,
          nom VARCHAR(100) NOT NULL,
          description TEXT,
          type VARCHAR(50) NOT NULL,
          parent_id BIGINT REFERENCES admin_units(id),
          manager_id BIGINT REFERENCES users(id),
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    },
    {
      name: 'system_settings',
      sql: `
        CREATE TABLE IF NOT EXISTS system_settings (
          id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          category VARCHAR(50) NOT NULL,
          key VARCHAR(100) NOT NULL,
          value JSONB NOT NULL,
          description TEXT,
          is_public BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(category, key)
        );
      `
    },
    {
      name: 'custom_reports',
      sql: `
        CREATE TABLE IF NOT EXISTS custom_reports (
          id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
          title VARCHAR(200) NOT NULL,
          description TEXT,
          report_type VARCHAR(50) NOT NULL,
          filters JSONB,
          columns JSONB,
          schedule JSONB,
          is_public BOOLEAN DEFAULT FALSE,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    },
    {
      name: 'notifications',
      sql: `
        CREATE TABLE IF NOT EXISTS notifications (
          id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
          title VARCHAR(200) NOT NULL,
          message TEXT NOT NULL,
          type VARCHAR(50) NOT NULL,
          category VARCHAR(50) NOT NULL,
          is_read BOOLEAN DEFAULT FALSE,
          is_sent BOOLEAN DEFAULT FALSE,
          sent_at TIMESTAMPTZ,
          expires_at TIMESTAMPTZ,
          metadata JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    },
    {
      name: 'user_sessions',
      sql: `
        CREATE TABLE IF NOT EXISTS user_sessions (
          id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
          session_token VARCHAR(500) UNIQUE NOT NULL,
          device_info JSONB,
          ip_address INET,
          user_agent TEXT,
          is_active BOOLEAN DEFAULT TRUE,
          last_activity TIMESTAMPTZ DEFAULT NOW(),
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    },
    {
      name: 'activity_logs',
      sql: `
        CREATE TABLE IF NOT EXISTS activity_logs (
          id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
          action VARCHAR(100) NOT NULL,
          entity_type VARCHAR(50) NOT NULL,
          entity_id BIGINT,
          details JSONB,
          ip_address INET,
          user_agent TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    }
  ];

  for (const table of tables) {
    try {
      console.log(`\n📝 Création de la table ${table.name}...`);
      
      // Utiliser l'API REST pour exécuter le SQL
      const { data, error } = await supabaseAdmin
        .from('_sql')
        .select('*')
        .limit(1);
      
      if (error && !error.message.includes('relation "_sql" does not exist')) {
        throw error;
      }

      // Alternative: utiliser rpc si disponible
      const { error: rpcError } = await supabaseAdmin.rpc('exec_sql', { 
        sql: table.sql 
      });
      
      if (rpcError) {
        console.log(`⚠️ Erreur RPC pour ${table.name}: ${rpcError.message}`);
        // Essayer une approche différente
        console.log(`📝 Table ${table.name} - SQL à exécuter manuellement:`);
        console.log(table.sql);
      } else {
        console.log(`✅ Table ${table.name} créée`);
      }

    } catch (error) {
      console.log(`⚠️ Erreur pour ${table.name}: ${error.message}`);
      console.log(`📝 SQL à exécuter manuellement dans Supabase Dashboard:`);
      console.log(table.sql);
    }
  }

  console.log('\n🎉 Processus de création terminé!');
  console.log('\n📋 Instructions manuelles:');
  console.log('1. Allez dans Supabase Dashboard → SQL Editor');
  console.log('2. Exécutez le contenu du fichier supabase/additional-tables.sql');
  console.log('3. Puis exécutez: node scripts/insert-initial-data.js');
}

createTablesIndividually();
