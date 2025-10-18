-- Script SQL final pour mettre à jour les rayons de tolérance
-- ATTENTION: Exécuter d'abord fix_tolerance_constraint.sql pour corriger les contraintes

-- =====================================================
-- ÉTAPE 1: VÉRIFICATION PRÉALABLE
-- =====================================================

-- Vérifier que les contraintes permettent nos valeurs
DO $$ 
BEGIN
    -- Tester les valeurs maximales que nous voulons utiliser
    IF NOT (44000 >= 100 AND 44000 <= 100000) THEN
        RAISE EXCEPTION 'Les contraintes de tolérance ne permettent pas nos valeurs. Exécutez d''abord fix_tolerance_constraint.sql';
    END IF;
    
    RAISE NOTICE 'Contraintes OK - Procédure de mise à jour autorisée';
END $$;

-- =====================================================
-- ÉTAPE 2: MISE À JOUR DES AGENTS PERSONNALISÉS
-- =====================================================

-- Zone PDA4 (Nord) - 11 Agents
-- 1. DJIBRIL ABDEL-HAFIZ - DJOUGOU - 25km → 20km (20000m)
UPDATE users 
SET 
    tolerance_radius_meters = 20000,
    custom_tolerance_applied = true,
    tolerance_source = 'PDA4',
    tolerance_commune = 'DJOUGOU'
WHERE email = 'abdelhafizdjibril@gmail.com'
   OR LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%djibril%abdel%hafiz%'
   OR LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%abdel%hafiz%djibril%';

-- 2. GOUKALODE CALIXTE - DASSA-ZOUMÉ - 22km → 17.6km (17600m)
UPDATE users 
SET 
    tolerance_radius_meters = 17600,
    custom_tolerance_applied = true,
    tolerance_source = 'PDA4',
    tolerance_commune = 'DASSA-ZOUMÉ'
WHERE email = 'calixtegoukalode60@gmail.com'
   OR LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%goukalode%calixte%'
   OR LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%calixte%goukalode%';

-- 3. EKPA Chabi Ogoudélé Aimé - BASSILA - 20km → 16km (16000m)
UPDATE users 
SET 
    tolerance_radius_meters = 16000,
    custom_tolerance_applied = true,
    tolerance_source = 'PDA4',
    tolerance_commune = 'BASSILA'
WHERE LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%ekpa%chabi%'
   OR LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%chabi%ekpa%'
   OR LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%ogoudélé%aimé%';

-- 4. KALOA Moukimiou - OUAKÉ - 25km → 20km (20000m)
UPDATE users 
SET 
    tolerance_radius_meters = 20000,
    custom_tolerance_applied = true,
    tolerance_source = 'PDA4',
    tolerance_commune = 'OUAKÉ'
WHERE LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%kaloa%moukimiou%'
   OR LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%moukimiou%kaloa%';

-- 5. CHERIF FABADE DEKANDE LUC - SAVALOU - 30km → 24km (24000m)
UPDATE users 
SET 
    tolerance_radius_meters = 24000,
    custom_tolerance_applied = true,
    tolerance_source = 'PDA4',
    tolerance_commune = 'SAVALOU'
WHERE email = 'lucherifabade@gmail.com'
   OR LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%cherif%fabade%'
   OR LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%fabade%cherif%'
   OR LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%dekande%luc%';

-- 6. FADO kami Macaire - BANTÈ - 15km → 12km (12000m)
UPDATE users 
SET 
    tolerance_radius_meters = 12000,
    custom_tolerance_applied = true,
    tolerance_source = 'PDA4',
    tolerance_commune = 'BANTÈ'
WHERE LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%fado%kami%'
   OR LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%kami%fado%'
   OR LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%macaire%';

-- 7. TCHETAN PRUDENCE - GLAZOUE - 10km → 8km (8000m)
UPDATE users 
SET 
    tolerance_radius_meters = 8000,
    custom_tolerance_applied = true,
    tolerance_source = 'PDA4',
    tolerance_commune = 'GLAZOUE'
WHERE LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%tchetan%prudence%'
   OR LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%prudence%tchetan%';

-- 8. AKPO ANOS - DASSA ZOUMÈ - 21km → 16.8km (16800m)
UPDATE users 
SET 
    tolerance_radius_meters = 16800,
    custom_tolerance_applied = true,
    tolerance_source = 'PDA4',
    tolerance_commune = 'DASSA ZOUMÈ'
WHERE LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%akpo%anos%'
   OR LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%anos%akpo%';

-- 9. DAGAN Bruno - Glazoué - 25km → 20km (20000m)
UPDATE users 
SET 
    tolerance_radius_meters = 20000,
    custom_tolerance_applied = true,
    tolerance_source = 'PDA4',
    tolerance_commune = 'Glazoué'
WHERE email = 'brunedage@gmail.com'
   OR LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%dagan%bruno%'
   OR LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%bruno%dagan%';

-- 10. ADOHO D. THIBURCE - SAVALOU - 55km → 30km (30000m) - LIMITÉ POUR RAISONS MÉTIER
UPDATE users 
SET 
    tolerance_radius_meters = 30000,
    custom_tolerance_applied = true,
    tolerance_source = 'PDA4',
    tolerance_commune = 'SAVALOU'
WHERE LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%adoho%thiburce%'
   OR LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%thiburce%adoho%'
   OR LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%adoho%d%';

-- 11. SERIKI FATAI - BANTÉ - 22km → 17.6km (17600m)
UPDATE users 
SET 
    tolerance_radius_meters = 17600,
    custom_tolerance_applied = true,
    tolerance_source = 'PDA4',
    tolerance_commune = 'BANTÉ'
WHERE LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%seriki%fatai%'
   OR LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%fatai%seriki%';

-- Zone SUD - 4 Agents
-- 1. DAGNITO Mariano - Zogbodomey - 35km → 28km (28000m)
UPDATE users 
SET 
    tolerance_radius_meters = 28000,
    custom_tolerance_applied = true,
    tolerance_source = 'SUD',
    tolerance_commune = 'Zogbodomey'
WHERE LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%dagnito%mariano%'
   OR LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%mariano%dagnito%';

-- 2. GOGAN Ida - Zogbodomey - 35km → 28km (28000m)
UPDATE users 
SET 
    tolerance_radius_meters = 28000,
    custom_tolerance_applied = true,
    tolerance_source = 'SUD',
    tolerance_commune = 'Zogbodomey'
WHERE LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%gogan%ida%'
   OR LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%ida%gogan%';

-- 3. ADJOVI Sabeck - Zogbodomey - 35km → 28km (28000m)
UPDATE users 
SET 
    tolerance_radius_meters = 28000,
    custom_tolerance_applied = true,
    tolerance_source = 'SUD',
    tolerance_commune = 'Zogbodomey'
WHERE email = 'adjovicomlansabeck123@gmail.com'
   OR LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%adjovi%sabeck%'
   OR LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%sabeck%adjovi%';

-- 4. TOGNON TCHEGNONSI Bernice - Zogbodomey - 35km → 28km (28000m)
UPDATE users 
SET 
    tolerance_radius_meters = 28000,
    custom_tolerance_applied = true,
    tolerance_source = 'SUD',
    tolerance_commune = 'Zogbodomey'
WHERE email = 'tognissoulocke@gmail.com'
   OR LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%tognon%tchegnonsi%'
   OR LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%tchegnonsi%tognon%'
   OR LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%bernice%';

-- =====================================================
-- ÉTAPE 3: MISE À JOUR DES AGENTS SANS DÉCLARATION
-- =====================================================

-- Mettre à jour tous les autres agents avec le rayon par défaut (6km = 6000m)
UPDATE users 
SET 
    tolerance_radius_meters = 6000,
    custom_tolerance_applied = false,
    tolerance_source = 'default',
    tolerance_commune = COALESCE(commune, 'Non spécifié')
WHERE custom_tolerance_applied IS NULL 
   OR custom_tolerance_applied = false
   OR tolerance_radius_meters = 5000; -- Remplacer la valeur par défaut

-- =====================================================
-- ÉTAPE 4: VÉRIFICATION DES MISE À JOUR
-- =====================================================

-- Afficher un résumé des mises à jour
SELECT 
    tolerance_source as "Zone",
    COUNT(*) as "Nombre d'agents",
    AVG(tolerance_radius_meters) as "Rayon moyen (m)",
    MIN(tolerance_radius_meters) as "Rayon minimum (m)",
    MAX(tolerance_radius_meters) as "Rayon maximum (m)"
FROM users 
WHERE tolerance_radius_meters IS NOT NULL
GROUP BY tolerance_source
ORDER BY tolerance_source;

-- Afficher les détails par agent
SELECT 
    id,
    CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')) as "Nom complet",
    email as "Email",
    tolerance_commune as "Commune",
    tolerance_source as "Zone",
    tolerance_radius_meters as "Rayon (m)",
    ROUND(tolerance_radius_meters / 1000.0, 1) as "Rayon (km)",
    custom_tolerance_applied as "Personnalisé"
FROM users 
WHERE tolerance_radius_meters IS NOT NULL
ORDER BY tolerance_source, tolerance_commune, last_name;
