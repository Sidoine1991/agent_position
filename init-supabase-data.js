#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://eoamsmtdspedumjmmeui.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvYW1zbXRkc3BlZHVtam1tZXVpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTAyNzIzOSwiZXhwIjoyMDc0NjAzMjM5fQ.SrDG8nvNxALqUSqXw3tGWuv9hgLF-bSyUdNmxcoYm_Y';

const supabase = createClient(supabaseUrl, supabaseKey);

async function initializeSupabaseData() {
  console.log('🔧 Initialisation des données Supabase...');
  
  try {
    // 1. Créer la table admin_units si elle n'existe pas
    console.log('📋 Création de la table admin_units...');
    const { error: createError } = await supabase.rpc('exec_sql', {
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
    });
    
    if (createError) {
      console.log('⚠️  Table admin_units peut-être déjà existante:', createError.message);
    } else {
      console.log('✅ Table admin_units créée');
    }
    
    // 2. Insérer des données d'exemple pour admin_units
    console.log('📊 Insertion des données d\'exemple...');
    const { error: insertError } = await supabase
      .from('admin_units')
      .upsert([
        {
          code: 'BEN',
          nom: 'Bénin',
          description: 'Pays du Bénin',
          type: 'country',
          is_active: true
        },
        {
          code: 'ATL',
          nom: 'Atlantique',
          description: 'Département de l\'Atlantique',
          type: 'departement',
          is_active: true
        },
        {
          code: 'LIT',
          nom: 'Littoral',
          description: 'Département du Littoral',
          type: 'departement',
          is_active: true
        },
        {
          code: 'PLA',
          nom: 'Plateau',
          description: 'Département du Plateau',
          type: 'departement',
          is_active: true
        }
      ], { onConflict: 'code' });
    
    if (insertError) {
      console.log('⚠️  Erreur insertion admin_units:', insertError.message);
    } else {
      console.log('✅ Données admin_units insérées');
    }
    
    // 3. Vérifier les paramètres de l'application
    console.log('⚙️  Vérification des paramètres...');
    const { data: settings, error: settingsError } = await supabase
      .from('app_settings')
      .select('*');
    
    if (settingsError) {
      console.log('⚠️  Erreur lecture settings:', settingsError.message);
    } else {
      console.log('✅ Paramètres trouvés:', settings?.length || 0);
    }
    
    // 4. Insérer des paramètres par défaut si nécessaire
    if (!settings || settings.length === 0) {
      console.log('📝 Insertion des paramètres par défaut...');
      const { error: defaultSettingsError } = await supabase
        .from('app_settings')
        .upsert([
          { key: 'app_name', value: 'Presence CCRB' },
          { key: 'version', value: '2.0.0' },
          { key: 'maintenance_mode', value: false },
          { key: 'registration_enabled', value: true }
        ], { onConflict: 'key' });
      
      if (defaultSettingsError) {
        console.log('⚠️  Erreur paramètres par défaut:', defaultSettingsError.message);
      } else {
        console.log('✅ Paramètres par défaut insérés');
      }
    }
    
    console.log('🎉 Initialisation terminée avec succès!');
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation:', error.message);
  }
}

// Exécuter l'initialisation
initializeSupabaseData();
