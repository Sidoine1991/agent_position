-- Script de mise à jour de la table presences
-- Exécuter ce script dans l'interface SQL de Supabase

-- 1. Renommer les colonnes si elles existent avec les anciens noms
DO $$
BEGIN
    -- Renommer timestamp en start_time
    IF EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'presences' AND column_name = 'timestamp') THEN
        ALTER TABLE presences RENAME COLUMN timestamp TO start_time;
        RAISE NOTICE '✅ Column timestamp renamed to start_time';
    END IF;
    
    -- Renommer photo_path en photo_url
    IF EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'presences' AND column_name = 'photo_path') THEN
        ALTER TABLE presences RENAME COLUMN photo_path TO photo_url;
        RAISE NOTICE '✅ Column photo_path renamed to photo_url';
    END IF;
    
    -- Renommer location_lon en location_lng si nécessaire
    IF EXISTS (SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'presences' AND column_name = 'location_lon') THEN
        ALTER TABLE presences RENAME COLUMN location_lon TO location_lng;
        RAISE NOTICE '✅ Column location_lon renamed to location_lng';
    END IF;
END $$;

-- 2. Ajouter les colonnes manquantes si elles n'existent pas
ALTER TABLE presences ADD COLUMN IF NOT EXISTS location_lat numeric(10, 8);
ALTER TABLE presences ADD COLUMN IF NOT EXISTS location_lng numeric(11, 8);
ALTER TABLE presences ADD COLUMN IF NOT EXISTS location_name character varying(255);
ALTER TABLE presences ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE presences ADD COLUMN IF NOT EXISTS photo_url character varying(500);
ALTER TABLE presences ADD COLUMN IF NOT EXISTS status character varying(20) DEFAULT 'active';
ALTER TABLE presences ADD COLUMN IF NOT EXISTS checkin_type character varying(50);
ALTER TABLE presences ADD COLUMN IF NOT EXISTS zone_id integer;
ALTER TABLE presences ADD COLUMN IF NOT EXISTS within_tolerance boolean;
ALTER TABLE presences ADD COLUMN IF NOT EXISTS distance_from_reference_m integer;
ALTER TABLE presences ADD COLUMN IF NOT EXISTS tolerance_meters integer;

-- 3. Créer les index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_presences_user_id ON presences(user_id);
CREATE INDEX IF NOT EXISTS idx_presences_zone_id ON presences(zone_id);
CREATE INDEX IF NOT EXISTS idx_presences_within_tolerance ON presences(within_tolerance);
CREATE INDEX IF NOT EXISTS idx_presences_status ON presences(status);
CREATE INDEX IF NOT EXISTS idx_presences_start_time ON presences(start_time);

-- 4. Ajouter les contraintes de validation
ALTER TABLE presences 
ADD CONSTRAINT IF NOT EXISTS presences_status_check 
CHECK (status IN ('active', 'completed', 'cancelled'));

-- 5. Mettre à jour les données existantes si nécessaire
UPDATE presences 
SET 
    status = COALESCE(status, 'active'),
    photo_url = COALESCE(photo_url, photo_path),
    location_lng = COALESCE(location_lng, location_lon)
WHERE status IS NULL OR photo_url IS NULL OR location_lng IS NULL;

-- 6. Vérification finale
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'presences' 
ORDER BY ordinal_position;

-- 7. Afficher un résumé des données
SELECT 
    COUNT(*) as total_presences,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_presences,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_presences,
    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_presences,
    COUNT(CASE WHEN photo_url IS NOT NULL THEN 1 END) as presences_with_photo,
    COUNT(CASE WHEN location_lat IS NOT NULL AND location_lng IS NOT NULL THEN 1 END) as presences_with_location
FROM presences;

RAISE NOTICE '🎉 Mise à jour de la table presences terminée avec succès!';
