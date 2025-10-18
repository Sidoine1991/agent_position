-- Script SQL pour ajouter les colonnes de tolérance à la table users
-- Exécuter ce script AVANT le script de mise à jour des rayons

-- =====================================================
-- AJOUT DES COLONNES MANQUANTES
-- =====================================================

-- 1. Ajouter la colonne tolerance_radius_meters (si elle n'existe pas)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'tolerance_radius_meters'
    ) THEN
        ALTER TABLE users ADD COLUMN tolerance_radius_meters INTEGER DEFAULT 5000;
        COMMENT ON COLUMN users.tolerance_radius_meters IS 'Rayon de tolérance GPS en mètres (défaut: 5000m = 5km)';
    END IF;
END $$;

-- 2. Ajouter la colonne custom_tolerance_applied
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'custom_tolerance_applied'
    ) THEN
        ALTER TABLE users ADD COLUMN custom_tolerance_applied BOOLEAN DEFAULT FALSE;
        COMMENT ON COLUMN users.custom_tolerance_applied IS 'Indique si le rayon de tolérance est personnalisé pour cet agent';
    END IF;
END $$;

-- 3. Ajouter la colonne tolerance_source
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'tolerance_source'
    ) THEN
        ALTER TABLE users ADD COLUMN tolerance_source VARCHAR(50) DEFAULT 'default';
        COMMENT ON COLUMN users.tolerance_source IS 'Source du rayon de tolérance (PDA4, SUD, default)';
    END IF;
END $$;

-- 4. Ajouter la colonne tolerance_commune
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'tolerance_commune'
    ) THEN
        ALTER TABLE users ADD COLUMN tolerance_commune VARCHAR(100);
        COMMENT ON COLUMN users.tolerance_commune IS 'Commune d''intervention de l''agent pour le calcul du rayon';
    END IF;
END $$;

-- =====================================================
-- VÉRIFICATION DES COLONNES AJOUTÉES
-- =====================================================

-- Afficher la structure de la table users
SELECT 
    column_name as "Nom de la colonne",
    data_type as "Type de données",
    is_nullable as "Nullable",
    column_default as "Valeur par défaut"
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name IN ('tolerance_radius_meters', 'custom_tolerance_applied', 'tolerance_source', 'tolerance_commune')
ORDER BY column_name;

-- =====================================================
-- INITIALISATION DES VALEURS PAR DÉFAUT
-- =====================================================

-- Mettre à jour les utilisateurs existants avec les valeurs par défaut
UPDATE users 
SET 
    tolerance_radius_meters = COALESCE(tolerance_radius_meters, 5000),
    custom_tolerance_applied = COALESCE(custom_tolerance_applied, FALSE),
    tolerance_source = COALESCE(tolerance_source, 'default'),
    tolerance_commune = COALESCE(tolerance_commune, commune)
WHERE tolerance_radius_meters IS NULL 
   OR custom_tolerance_applied IS NULL 
   OR tolerance_source IS NULL;

-- =====================================================
-- VÉRIFICATION FINALE
-- =====================================================

-- Compter les utilisateurs par source de tolérance
SELECT 
    tolerance_source as "Source",
    COUNT(*) as "Nombre d'utilisateurs",
    AVG(tolerance_radius_meters) as "Rayon moyen (m)",
    MIN(tolerance_radius_meters) as "Rayon minimum (m)",
    MAX(tolerance_radius_meters) as "Rayon maximum (m)"
FROM users 
GROUP BY tolerance_source
ORDER BY tolerance_source;

-- Afficher un échantillon des données
SELECT 
    id,
    first_name,
    last_name,
    email,
    tolerance_radius_meters,
    custom_tolerance_applied,
    tolerance_source,
    tolerance_commune
FROM users 
ORDER BY id
LIMIT 10;
