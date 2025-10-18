-- Script sécurisé pour créer la table presences
-- Ce script vérifie d'abord si la table existe avant de la créer

-- Vérifier si la table presences existe déjà
DO $$
BEGIN
    -- Créer la table seulement si elle n'existe pas
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'presences') THEN
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

-- Créer les index seulement s'ils n'existent pas
CREATE INDEX IF NOT EXISTS idx_presences_user_id ON presences(user_id);
CREATE INDEX IF NOT EXISTS idx_presences_start_time ON presences(start_time);

-- Vérifier l'état final
SELECT 
    'presences' as table_name,
    CASE 
        WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'presences') 
        THEN 'EXISTS' 
        ELSE 'MISSING' 
    END as status,
    COUNT(*) as record_count
FROM presences;
