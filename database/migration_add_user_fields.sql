-- Migration pour ajouter les champs supplémentaires à la table users
-- Ces champs sont spécifiques aux employés (agents/superviseurs) et ne s'appliquent pas aux administrateurs

-- Ajouter les colonnes géographiques
ALTER TABLE users ADD COLUMN IF NOT EXISTS departement VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS commune VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS arrondissement VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS village VARCHAR(100);

-- Ajouter les colonnes liées au projet
ALTER TABLE users ADD COLUMN IF NOT EXISTS project_name VARCHAR(255);

-- Ajouter les colonnes de géolocalisation (spécifiques aux employés)
ALTER TABLE users ADD COLUMN IF NOT EXISTS reference_lat DECIMAL(10, 8);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reference_lon DECIMAL(11, 8);
ALTER TABLE users ADD COLUMN IF NOT EXISTS tolerance_radius_meters INTEGER;

-- Ajouter les colonnes de contrat et ancienneté (spécifiques aux employés)
ALTER TABLE users ADD COLUMN IF NOT EXISTS expected_days_per_month INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS expected_hours_per_month INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS contract_start_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS contract_end_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS years_of_service DECIMAL(4, 1);

-- Ajouter des contraintes pour les champs numériques (avec gestion d'erreur)
DO $$ 
BEGIN
    -- Contrainte pour tolerance_radius_meters
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'check_tolerance_radius' 
        AND table_name = 'users'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT check_tolerance_radius 
            CHECK (tolerance_radius_meters IS NULL OR (tolerance_radius_meters >= 10 AND tolerance_radius_meters <= 10000));
    END IF;
    
    -- Contrainte pour expected_days_per_month
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'check_expected_days' 
        AND table_name = 'users'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT check_expected_days 
            CHECK (expected_days_per_month IS NULL OR (expected_days_per_month >= 0 AND expected_days_per_month <= 31));
    END IF;
    
    -- Contrainte pour expected_hours_per_month
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'check_expected_hours' 
        AND table_name = 'users'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT check_expected_hours 
            CHECK (expected_hours_per_month IS NULL OR (expected_hours_per_month >= 0 AND expected_hours_per_month <= 744));
    END IF;
    
    -- Contrainte pour years_of_service
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'check_years_of_service' 
        AND table_name = 'users'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT check_years_of_service 
            CHECK (years_of_service IS NULL OR (years_of_service >= 0 AND years_of_service <= 50));
    END IF;
END $$;

-- Ajouter des index pour les performances
CREATE INDEX IF NOT EXISTS idx_users_departement ON users(departement);
CREATE INDEX IF NOT EXISTS idx_users_commune ON users(commune);
CREATE INDEX IF NOT EXISTS idx_users_project_name ON users(project_name);
CREATE INDEX IF NOT EXISTS idx_users_contract_dates ON users(contract_start_date, contract_end_date);

-- Commentaire sur l'utilisation des champs
COMMENT ON COLUMN users.reference_lat IS 'Latitude de référence pour la géolocalisation (employés uniquement)';
COMMENT ON COLUMN users.reference_lon IS 'Longitude de référence pour la géolocalisation (employés uniquement)';
COMMENT ON COLUMN users.tolerance_radius_meters IS 'Rayon de tolérance en mètres pour la géolocalisation (employés uniquement)';
COMMENT ON COLUMN users.expected_days_per_month IS 'Nombre de jours attendus par mois (employés uniquement)';
COMMENT ON COLUMN users.expected_hours_per_month IS 'Nombre d''heures attendues par mois (employés uniquement)';
COMMENT ON COLUMN users.contract_start_date IS 'Date de début du contrat sur le projet (employés uniquement)';
COMMENT ON COLUMN users.contract_end_date IS 'Date de fin du contrat sur le projet (employés uniquement)';
COMMENT ON COLUMN users.years_of_service IS 'Nombre d''années d''ancienneté au CCR-B (employés uniquement)';
