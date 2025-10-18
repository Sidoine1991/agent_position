-- Script SQL pour mettre à jour les rayons de tolérance personnalisés dans la table users
-- Basé sur les distances déclarées par les agents (distance déclarée × 0.8)

-- =====================================================
-- ZONE PDA4 (Nord) - 11 Agents
-- =====================================================

-- 1. DJIBRIL ABDEL-HAFIZ - DJOUGOU - 25km → 20km (20000m)
UPDATE users 
SET tolerance_radius_meters = 20000,
    custom_tolerance_applied = true,
    tolerance_source = 'PDA4',
    tolerance_commune = 'DJOUGOU'
WHERE LOWER(TRIM(CONCAT(first_name, ' ', last_name))) LIKE '%djibril%abdel%hafiz%'
   OR LOWER(TRIM(CONCAT(first_name, ' ', last_name))) LIKE '%abdel%hafiz%djibril%'
   OR email LIKE '%djibril%'
   OR email LIKE '%abdel%hafiz%';

-- 2. GOUKALODE CALIXTE - DASSA-ZOUMÉ - 22km → 17.6km (17600m)
UPDATE users 
SET tolerance_radius_meters = 17600,
    custom_tolerance_applied = true,
    tolerance_source = 'PDA4',
    tolerance_commune = 'DASSA-ZOUMÉ'
WHERE LOWER(TRIM(CONCAT(first_name, ' ', last_name))) LIKE '%goukalode%calixte%'
   OR LOWER(TRIM(CONCAT(first_name, ' ', last_name))) LIKE '%calixte%goukalode%'
   OR email LIKE '%goukalode%'
   OR email LIKE '%calixte%';

-- 3. EKPA Chabi Ogoudélé Aimé - BASSILA - 20km → 16km (16000m)
UPDATE users 
SET tolerance_radius_meters = 16000,
    custom_tolerance_applied = true,
    tolerance_source = 'PDA4',
    tolerance_commune = 'BASSILA'
WHERE LOWER(TRIM(CONCAT(first_name, ' ', last_name))) LIKE '%ekpa%chabi%'
   OR LOWER(TRIM(CONCAT(first_name, ' ', last_name))) LIKE '%chabi%ekpa%'
   OR LOWER(TRIM(CONCAT(first_name, ' ', last_name))) LIKE '%ogoudélé%aimé%'
   OR email LIKE '%ekpa%'
   OR email LIKE '%chabi%';

-- 4. KALOA Moukimiou - OUAKÉ - 25km → 20km (20000m)
UPDATE users 
SET tolerance_radius_meters = 20000,
    custom_tolerance_applied = true,
    tolerance_source = 'PDA4',
    tolerance_commune = 'OUAKÉ'
WHERE LOWER(TRIM(CONCAT(first_name, ' ', last_name))) LIKE '%kaloa%moukimiou%'
   OR LOWER(TRIM(CONCAT(first_name, ' ', last_name))) LIKE '%moukimiou%kaloa%'
   OR email LIKE '%kaloa%'
   OR email LIKE '%moukimiou%';

-- 5. CHERIF FABADE DEKANDE LUC - SAVALOU - 30km → 24km (24000m)
UPDATE users 
SET tolerance_radius_meters = 24000,
    custom_tolerance_applied = true,
    tolerance_source = 'PDA4',
    tolerance_commune = 'SAVALOU'
WHERE LOWER(TRIM(CONCAT(first_name, ' ', last_name))) LIKE '%cherif%fabade%'
   OR LOWER(TRIM(CONCAT(first_name, ' ', last_name))) LIKE '%fabade%cherif%'
   OR LOWER(TRIM(CONCAT(first_name, ' ', last_name))) LIKE '%dekande%luc%'
   OR email LIKE '%cherif%'
   OR email LIKE '%fabade%'
   OR email LIKE '%dekande%';

-- 6. FADO kami Macaire - BANTÈ - 15km → 12km (12000m)
UPDATE users 
SET tolerance_radius_meters = 12000,
    custom_tolerance_applied = true,
    tolerance_source = 'PDA4',
    tolerance_commune = 'BANTÈ'
WHERE LOWER(TRIM(CONCAT(first_name, ' ', last_name))) LIKE '%fado%kami%'
   OR LOWER(TRIM(CONCAT(first_name, ' ', last_name))) LIKE '%kami%fado%'
   OR LOWER(TRIM(CONCAT(first_name, ' ', last_name))) LIKE '%macaire%'
   OR email LIKE '%fado%'
   OR email LIKE '%kami%'
   OR email LIKE '%macaire%';

-- 7. TCHETAN PRUDENCE - GLAZOUE - 10km → 8km (8000m)
UPDATE users 
SET tolerance_radius_meters = 8000,
    custom_tolerance_applied = true,
    tolerance_source = 'PDA4',
    tolerance_commune = 'GLAZOUE'
WHERE LOWER(TRIM(CONCAT(first_name, ' ', last_name))) LIKE '%tchetan%prudence%'
   OR LOWER(TRIM(CONCAT(first_name, ' ', last_name))) LIKE '%prudence%tchetan%'
   OR email LIKE '%tchetan%'
   OR email LIKE '%prudence%';

-- 8. AKPO ANOS - DASSA ZOUMÈ - 21km → 16.8km (16800m)
UPDATE users 
SET tolerance_radius_meters = 16800,
    custom_tolerance_applied = true,
    tolerance_source = 'PDA4',
    tolerance_commune = 'DASSA ZOUMÈ'
WHERE LOWER(TRIM(CONCAT(first_name, ' ', last_name))) LIKE '%akpo%anos%'
   OR LOWER(TRIM(CONCAT(first_name, ' ', last_name))) LIKE '%anos%akpo%'
   OR email LIKE '%akpo%'
   OR email LIKE '%anos%';

-- 9. DAGAN Bruno - Glazoué - 25km → 20km (20000m)
UPDATE users 
SET tolerance_radius_meters = 20000,
    custom_tolerance_applied = true,
    tolerance_source = 'PDA4',
    tolerance_commune = 'Glazoué'
WHERE LOWER(TRIM(CONCAT(first_name, ' ', last_name))) LIKE '%dagan%bruno%'
   OR LOWER(TRIM(CONCAT(first_name, ' ', last_name))) LIKE '%bruno%dagan%'
   OR email LIKE '%dagan%'
   OR email LIKE '%bruno%';

-- 10. ADOHO D. THIBURCE - SAVALOU - 55km → 44km (44000m)
UPDATE users 
SET tolerance_radius_meters = 44000,
    custom_tolerance_applied = true,
    tolerance_source = 'PDA4',
    tolerance_commune = 'SAVALOU'
WHERE LOWER(TRIM(CONCAT(first_name, ' ', last_name))) LIKE '%adoho%thiburce%'
   OR LOWER(TRIM(CONCAT(first_name, ' ', last_name))) LIKE '%thiburce%adoho%'
   OR LOWER(TRIM(CONCAT(first_name, ' ', last_name))) LIKE '%adoho%d%'
   OR email LIKE '%adoho%'
   OR email LIKE '%thiburce%';

-- 11. SERIKI FATAI - BANTÉ - 22km → 17.6km (17600m)
UPDATE users 
SET tolerance_radius_meters = 17600,
    custom_tolerance_applied = true,
    tolerance_source = 'PDA4',
    tolerance_commune = 'BANTÉ'
WHERE LOWER(TRIM(CONCAT(first_name, ' ', last_name))) LIKE '%seriki%fatai%'
   OR LOWER(TRIM(CONCAT(first_name, ' ', last_name))) LIKE '%fatai%seriki%'
   OR email LIKE '%seriki%'
   OR email LIKE '%fatai%';

-- =====================================================
-- ZONE SUD - 4 Agents
-- =====================================================

-- 1. DAGNITO Mariano - Zogbodomey - 35km → 28km (28000m)
UPDATE users 
SET tolerance_radius_meters = 28000,
    custom_tolerance_applied = true,
    tolerance_source = 'SUD',
    tolerance_commune = 'Zogbodomey'
WHERE LOWER(TRIM(CONCAT(first_name, ' ', last_name))) LIKE '%dagnito%mariano%'
   OR LOWER(TRIM(CONCAT(first_name, ' ', last_name))) LIKE '%mariano%dagnito%'
   OR email LIKE '%dagnito%'
   OR email LIKE '%mariano%';

-- 2. GOGAN Ida - Zogbodomey - 35km → 28km (28000m)
UPDATE users 
SET tolerance_radius_meters = 28000,
    custom_tolerance_applied = true,
    tolerance_source = 'SUD',
    tolerance_commune = 'Zogbodomey'
WHERE LOWER(TRIM(CONCAT(first_name, ' ', last_name))) LIKE '%gogan%ida%'
   OR LOWER(TRIM(CONCAT(first_name, ' ', last_name))) LIKE '%ida%gogan%'
   OR email LIKE '%gogan%'
   OR email LIKE '%ida%';

-- 3. ADJOVI Sabeck - Zogbodomey - 35km → 28km (28000m)
UPDATE users 
SET tolerance_radius_meters = 28000,
    custom_tolerance_applied = true,
    tolerance_source = 'SUD',
    tolerance_commune = 'Zogbodomey'
WHERE LOWER(TRIM(CONCAT(first_name, ' ', last_name))) LIKE '%adjovi%sabeck%'
   OR LOWER(TRIM(CONCAT(first_name, ' ', last_name))) LIKE '%sabeck%adjovi%'
   OR email LIKE '%adjovi%'
   OR email LIKE '%sabeck%';

-- 4. TOGNON TCHEGNONSI Bernice - Zogbodomey - 35km → 28km (28000m)
UPDATE users 
SET tolerance_radius_meters = 28000,
    custom_tolerance_applied = true,
    tolerance_source = 'SUD',
    tolerance_commune = 'Zogbodomey'
WHERE LOWER(TRIM(CONCAT(first_name, ' ', last_name))) LIKE '%tognon%tchegnonsi%'
   OR LOWER(TRIM(CONCAT(first_name, ' ', last_name))) LIKE '%tchegnonsi%tognon%'
   OR LOWER(TRIM(CONCAT(first_name, ' ', last_name))) LIKE '%bernice%'
   OR email LIKE '%tognon%'
   OR email LIKE '%tchegnonsi%'
   OR email LIKE '%bernice%';

-- =====================================================
-- AGENTS SANS DÉCLARATION - Rayon par défaut
-- =====================================================

-- Mettre à jour tous les autres agents avec le rayon par défaut (6km = 6000m)
UPDATE users 
SET tolerance_radius_meters = 6000,
    custom_tolerance_applied = false,
    tolerance_source = 'default',
    tolerance_commune = COALESCE(commune, 'Non spécifié')
WHERE custom_tolerance_applied IS NULL 
   OR custom_tolerance_applied = false
   OR tolerance_radius_meters IS NULL;

-- =====================================================
-- VÉRIFICATION DES MISE À JOUR
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
    CONCAT(first_name, ' ', last_name) as "Nom complet",
    email as "Email",
    tolerance_commune as "Commune",
    tolerance_source as "Zone",
    tolerance_radius_meters as "Rayon (m)",
    ROUND(tolerance_radius_meters / 1000.0, 1) as "Rayon (km)",
    custom_tolerance_applied as "Personnalisé"
FROM users 
WHERE tolerance_radius_meters IS NOT NULL
ORDER BY tolerance_source, tolerance_commune, last_name;
