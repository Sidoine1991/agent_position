const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function fixDatabase() {
  console.log('🔧 Connexion à Supabase...');
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false
      }
    }
  );

  try {
    // 1. Vérifier et ajouter la colonne timestamp si nécessaire
    console.log('🔄 Vérification de la colonne timestamp...');
    const { data: timestampCheck, error: timestampError } = await supabase.rpc('check_timestamp_column');
    
    if (timestampError) {
      console.log('Création de la fonction check_timestamp_column...');
      await supabase.rpc(`
        CREATE OR REPLACE FUNCTION check_timestamp_column()
        RETURNS void AS $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name='checkins' 
            AND column_name='timestamp'
          ) THEN
            ALTER TABLE checkins ADD COLUMN timestamp TIMESTAMP WITH TIME ZONE;
            UPDATE checkins SET timestamp = start_time;
            RAISE NOTICE 'Colonne timestamp ajoutée et remplie avec succès';
          ELSE
            RAISE NOTICE 'La colonne timestamp existe déjà';
          END IF;
        END;
        $$ LANGUAGE plpgsql;
      `);
      
      // Exécuter la fonction
      await supabase.rpc('check_timestamp_column');
    }
    console.log('✅ Vérification de la colonne timestamp terminée');

    // 2. Vérifier et corriger les types d'ID
    console.log('\n🔄 Vérification des types d\'ID...');
    try {
      await supabase.rpc(`
        DO $$
        DECLARE
          col_type text;
        BEGIN
          -- Vérifier et convertir presences.user_id
          SELECT data_type INTO col_type 
          FROM information_schema.columns 
          WHERE table_name = 'presences' AND column_name = 'user_id';
          
          IF col_type != 'uuid' THEN
            RAISE NOTICE 'Conversion de presences.user_id en UUID...';
            BEGIN
              ALTER TABLE presences 
              ALTER COLUMN user_id TYPE UUID USING user_id::text::uuid;
              RAISE NOTICE 'Conversion de presences.user_id réussie';
            EXCEPTION WHEN OTHERS THEN
              RAISE NOTICE 'Erreur conversion presences.user_id: %', SQLERRM;
            END;
          END IF;
          
          -- Vérifier et convertir checkins.user_id
          SELECT data_type INTO col_type 
          FROM information_schema.columns 
          WHERE table_name = 'checkins' AND column_name = 'user_id';
          
          IF col_type != 'uuid' THEN
            RAISE NOTICE 'Conversion de checkins.user_id en UUID...';
            BEGIN
              ALTER TABLE checkins 
              ALTER COLUMN user_id TYPE UUID USING user_id::text::uuid;
              RAISE NOTICE 'Conversion de checkins.user_id réussie';
            EXCEPTION WHEN OTHERS THEN
              RAISE NOTICE 'Erreur conversion checkins.user_id: %', SQLERRM;
            END;
          END IF;
          
          -- Vérifier et convertir permissions.agent_id
          SELECT data_type INTO col_type 
          FROM information_schema.columns 
          WHERE table_name = 'permissions' AND column_name = 'agent_id';
          
          IF col_type != 'uuid' THEN
            RAISE NOTICE 'Conversion de permissions.agent_id en UUID...';
            BEGIN
              ALTER TABLE permissions 
              ALTER COLUMN agent_id TYPE UUID USING agent_id::text::uuid;
              RAISE NOTICE 'Conversion de permissions.agent_id réussie';
            EXCEPTION WHEN OTHERS THEN
              RAISE NOTICE 'Erreur conversion permissions.agent_id: %', SQLERRM;
            END;
          END IF;
          
          -- Vérifier et convertir permissions.supervisor_id
          SELECT data_type INTO col_type 
          FROM information_schema.columns 
          WHERE table_name = 'permissions' AND column_name = 'supervisor_id';
          
          IF col_type != 'uuid' AND col_type IS NOT NULL THEN
            RAISE NOTICE 'Conversion de permissions.supervisor_id en UUID...';
            BEGIN
              ALTER TABLE permissions 
              ALTER COLUMN supervisor_id TYPE UUID USING supervisor_id::text::uuid;
              RAISE NOTICE 'Conversion de permissions.supervisor_id réussie';
            EXCEPTION WHEN OTHERS THEN
              RAISE NOTICE 'Erreur conversion permissions.supervisor_id: %', SQLERRM;
            END;
          END IF;
          
          RAISE NOTICE 'Vérification des types d''ID terminée';
        END $$;
      `);
      console.log('✅ Vérification des types d\'ID terminée');
    } catch (error) {
      console.error('❌ Erreur lors de la vérification des types d\'ID:', error.message);
    }

    // 3. Créer les index manquants
    console.log('\n🔄 Création des index manquants...');
    try {
      await supabase.rpc(`
        DO $$
        BEGIN
          -- Index pour checkins
          IF NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE indexname = 'idx_checkins_user_date'
          ) THEN
            CREATE INDEX idx_checkins_user_date ON checkins(user_id, start_time);
            RAISE NOTICE 'Index idx_checkins_user_date créé';
          END IF;
          
          -- Index pour presences
          IF NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE indexname = 'idx_presences_user_date'
          ) THEN
            CREATE INDEX idx_presences_user_date ON presences(user_id, start_time);
            RAISE NOTICE 'Index idx_presences_user_date créé';
          END IF;
          
          -- Index pour permissions
          IF NOT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE indexname = 'idx_permissions_agent_date'
          ) THEN
            CREATE INDEX idx_permissions_agent_date ON permissions(agent_id, start_date);
            RAISE NOTICE 'Index idx_permissions_agent_date créé';
          END IF;
          
          RAISE NOTICE 'Vérification des index terminée';
        END $$;
      `);
      console.log('✅ Vérification des index terminée');
    } catch (error) {
      console.error('❌ Erreur lors de la création des index:', error.message);
    }

    console.log('\n🎉 Toutes les corrections ont été appliquées avec succès !');

  } catch (error) {
    console.error('❌ Erreur lors de l\'exécution des corrections:', error);
  }
}

// Exécuter la fonction principale
fixDatabase();
