
-- Script de correction pour la table presences
-- Exécutez ce script dans le SQL Editor de Supabase

-- 1. Vérifier si la table existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'presences') THEN
        -- Créer la table presences
        CREATE TABLE presences (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id),
            start_time TIMESTAMP NOT NULL,
            end_time TIMESTAMP,
            location_lat DECIMAL(10, 8),
            location_lng DECIMAL(11, 8),
            location_name VARCHAR(255),
            notes TEXT,
            photo_url VARCHAR(500),
            status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
            checkin_type VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        RAISE NOTICE 'Table presences créée avec succès!';
    ELSE
        RAISE NOTICE 'Table presences existe déjà.';
    END IF;
END $$;

-- 2. Créer les index seulement s'ils n'existent pas
CREATE INDEX IF NOT EXISTS idx_presences_user_id ON presences(user_id);
CREATE INDEX IF NOT EXISTS idx_presences_start_time ON presences(start_time);

-- 3. Vérifier le résultat
SELECT 
    'presences' as table_name,
    CASE 
        WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'presences') 
        THEN 'EXISTS' 
        ELSE 'MISSING' 
    END as status;

-- 4. Compter les enregistrements
SELECT COUNT(*) as record_count FROM presences;
