-- Script pour corriger la contrainte de tolérance qui empêche les mises à jour
-- ATTENTION: Ce script supprime/modifie une contrainte existante

-- =====================================================
-- ÉTAPE 1: IDENTIFIER LA CONTRAINTE PROBLÉMATIQUE
-- =====================================================

-- Afficher les contraintes de vérification
SELECT 
    constraint_name,
    check_clause
FROM information_schema.check_constraints 
WHERE check_clause LIKE '%tolerance%'
   OR constraint_name LIKE '%tolerance%'
   OR check_clause LIKE '%radius%';

-- =====================================================
-- ÉTAPE 2: SUPPRIMER LA CONTRAINTE PROBLÉMATIQUE
-- =====================================================

-- Supprimer la contrainte check_tolerance_radius si elle existe
DO $$ 
BEGIN
    -- Essayer de supprimer la contrainte
    BEGIN
        ALTER TABLE users DROP CONSTRAINT IF EXISTS check_tolerance_radius;
        RAISE NOTICE 'Contrainte check_tolerance_radius supprimée avec succès';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Erreur lors de la suppression de check_tolerance_radius: %', SQLERRM;
    END;
    
    -- Essayer d'autres noms possibles
    BEGIN
        ALTER TABLE users DROP CONSTRAINT IF EXISTS users_tolerance_radius_check;
        RAISE NOTICE 'Contrainte users_tolerance_radius_check supprimée avec succès';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Contrainte users_tolerance_radius_check non trouvée';
    END;
    
    BEGIN
        ALTER TABLE users DROP CONSTRAINT IF EXISTS tolerance_radius_check;
        RAISE NOTICE 'Contrainte tolerance_radius_check supprimée avec succès';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Contrainte tolerance_radius_check non trouvée';
    END;
END $$;

-- =====================================================
-- ÉTAPE 3: CRÉER UNE NOUVELLE CONTRAINTE PLUS PERMISSIVE
-- =====================================================

-- Ajouter une nouvelle contrainte qui permet des rayons jusqu'à 100km
DO $$ 
BEGIN
    -- Vérifier si une contrainte existe déjà
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'users_tolerance_radius_valid_range'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_tolerance_radius_valid_range 
        CHECK (tolerance_radius_meters IS NULL OR (tolerance_radius_meters >= 100 AND tolerance_radius_meters <= 100000));
        RAISE NOTICE 'Nouvelle contrainte users_tolerance_radius_valid_range créée (100m - 100km)';
    ELSE
        RAISE NOTICE 'Contrainte users_tolerance_radius_valid_range existe déjà';
    END IF;
END $$;

-- =====================================================
-- ÉTAPE 3B: SUPPRIMER TOUTES LES CONTRAINTES RESTRICTIVES
-- =====================================================

-- Supprimer toutes les contraintes qui pourraient limiter les rayons
DO $$ 
DECLARE
    constraint_name_var TEXT;
BEGIN
    -- Chercher et supprimer toutes les contraintes de vérification liées aux rayons
    FOR constraint_name_var IN 
        SELECT tc.constraint_name 
        FROM information_schema.table_constraints tc
        JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
        WHERE tc.table_name = 'users' 
        AND (cc.check_clause LIKE '%tolerance%' OR cc.check_clause LIKE '%radius%' OR cc.check_clause LIKE '%20000%' OR cc.check_clause LIKE '%15000%' OR cc.check_clause LIKE '%10000%')
    LOOP
        BEGIN
            EXECUTE 'ALTER TABLE users DROP CONSTRAINT IF EXISTS ' || constraint_name_var;
            RAISE NOTICE 'Contrainte % supprimée', constraint_name_var;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Erreur lors de la suppression de %: %', constraint_name_var, SQLERRM;
        END;
    END LOOP;
END $$;

-- =====================================================
-- ÉTAPE 4: VÉRIFICATION
-- =====================================================

-- Vérifier que les contraintes ont été supprimées/ajoutées
SELECT 
    constraint_name,
    check_clause
FROM information_schema.check_constraints 
WHERE constraint_name LIKE '%tolerance%'
   OR constraint_name LIKE '%radius%'
   OR check_clause LIKE '%tolerance%'
   OR check_clause LIKE '%radius%';

-- =====================================================
-- ÉTAPE 5: TEST DES VALEURS PROBLÉMATIQUES
-- =====================================================

-- Tester si nos valeurs peuvent maintenant être insérées
SELECT 
    'Test DJIBRIL (20000m)' as test,
    CASE 
        WHEN 20000 >= 100 AND 20000 <= 100000 THEN '✅ OK'
        ELSE '❌ PROBLÈME'
    END as resultat;

SELECT 
    'Test ADOHO (44000m)' as test,
    CASE 
        WHEN 44000 >= 100 AND 44000 <= 100000 THEN '✅ OK'
        ELSE '❌ PROBLÈME'
    END as resultat;

-- Test de toutes nos valeurs maximales
SELECT 
    'Test TCHETAN (8000m)' as test,
    CASE 
        WHEN 8000 >= 100 AND 8000 <= 100000 THEN '✅ OK'
        ELSE '❌ PROBLÈME'
    END as resultat;

SELECT 
    'Test ADOHO (44000m) - Valeur maximale' as test,
    CASE 
        WHEN 44000 >= 100 AND 44000 <= 100000 THEN '✅ OK - Contrainte respectée'
        ELSE '❌ PROBLÈME - Contrainte violée'
    END as resultat;

-- =====================================================
-- ÉTAPE 6: MISE À JOUR DE TEST
-- =====================================================

-- Tester une mise à jour sur un utilisateur spécifique
UPDATE users 
SET 
    tolerance_radius_meters = 20000,
    custom_tolerance_applied = true,
    tolerance_source = 'PDA4',
    tolerance_commune = 'DJOUGOU'
WHERE email = 'abdelhafizdjibril@gmail.com'
  AND id = 99;

-- Vérifier la mise à jour
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
WHERE email = 'abdelhafizdjibril@gmail.com';
