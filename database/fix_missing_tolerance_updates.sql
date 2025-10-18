-- Script pour corriger les agents qui ont encore le rayon par défaut (6km)
-- Basé sur l'analyse de la table users actuelle

-- =====================================================
-- CORRECTION DES AGENTS PDA4 MANQUANTS
-- =====================================================

-- 3. EKPA Chabi Ogoudélé Aimé - BASSILA - 20km → 16km (16000m)
UPDATE users 
SET 
    tolerance_radius_meters = 16000,
    custom_tolerance_applied = true,
    tolerance_source = 'PDA4',
    tolerance_commune = 'BASSILA'
WHERE email = 'ekpaaime64@gmail.com';

-- 4. KALOA Moukimiou - OUAKÉ - 25km → 20km (20000m)
UPDATE users 
SET 
    tolerance_radius_meters = 20000,
    custom_tolerance_applied = true,
    tolerance_source = 'PDA4',
    tolerance_commune = 'OUAKÉ'
WHERE email = 'kaloamoukimiou@gmail.com';

-- 6. FADO Kami Macaire - BANTÈ - 15km → 12km (12000m)
UPDATE users 
SET 
    tolerance_radius_meters = 12000,
    custom_tolerance_applied = true,
    tolerance_source = 'PDA4',
    tolerance_commune = 'BANTÈ'
WHERE email = 'macairefado18@gmail.com';

-- 7. TCHETAN Liwan Prudence - GLAZOUE - 10km → 8km (8000m)
UPDATE users 
SET 
    tolerance_radius_meters = 8000,
    custom_tolerance_applied = true,
    tolerance_source = 'PDA4',
    tolerance_commune = 'GLAZOUE'
WHERE email = 'prudo1980@gmail.com';

-- 8. AKPO BABATOUNDÉ SADRESSE ANOS - DASSA ZOUMÈ - 21km → 16.8km (16800m)
UPDATE users 
SET 
    tolerance_radius_meters = 16800,
    custom_tolerance_applied = true,
    tolerance_source = 'PDA4',
    tolerance_commune = 'DASSA ZOUMÈ'
WHERE email = 'anosakpo@gmail.com';

-- 10. ADOHO THIBURCE - SAVALOU - 55km → 30km (30000m) - LIMITÉ POUR RAISONS MÉTIER
UPDATE users 
SET 
    tolerance_radius_meters = 30000,
    custom_tolerance_applied = true,
    tolerance_source = 'PDA4',
    tolerance_commune = 'SAVALOU'
WHERE email = 'thiburce976@gmail.com';

-- 11. SERIKI FATAÏ - BANTÉ - 22km → 17.6km (17600m)
UPDATE users 
SET 
    tolerance_radius_meters = 17600,
    custom_tolerance_applied = true,
    tolerance_source = 'PDA4',
    tolerance_commune = 'BANTÉ'
WHERE email = 'fataiseriki01@gmail.com';

-- =====================================================
-- CORRECTION DES AGENTS SUD MANQUANTS
-- =====================================================

-- 1. DAGNITO Mariano - Zogbodomey - 35km → 28km (28000m)
UPDATE users 
SET 
    tolerance_radius_meters = 28000,
    custom_tolerance_applied = true,
    tolerance_source = 'SUD',
    tolerance_commune = 'Zogbodomey'
WHERE email = 'damarubb@gmail.com';

-- 2. GOGAN Ida - Zogbodomey - 35km → 28km (28000m)
UPDATE users 
SET 
    tolerance_radius_meters = 28000,
    custom_tolerance_applied = true,
    tolerance_source = 'SUD',
    tolerance_commune = 'Zogbodomey'
WHERE email = 'idagogan16@gmail.com';

-- 4. TOGNON TCHEGNONSI BERNICE - Zogbodomey - 35km → 28km (28000m)
UPDATE users 
SET 
    tolerance_radius_meters = 28000,
    custom_tolerance_applied = true,
    tolerance_source = 'SUD',
    tolerance_commune = 'Zogbodomey'
WHERE email = 'bernice.tognon@gmail.com';

-- =====================================================
-- VÉRIFICATION DES MISE À JOUR
-- =====================================================

-- Vérifier que tous les agents ont été mis à jour
SELECT 
    'Vérification finale' as "Type",
    COUNT(*) as "Total agents personnalisés",
    COUNT(CASE WHEN tolerance_source = 'PDA4' THEN 1 END) as "Zone PDA4",
    COUNT(CASE WHEN tolerance_source = 'SUD' THEN 1 END) as "Zone SUD",
    AVG(tolerance_radius_meters) as "Rayon moyen (m)",
    MIN(tolerance_radius_meters) as "Rayon minimum (m)",
    MAX(tolerance_radius_meters) as "Rayon maximum (m)"
FROM users 
WHERE custom_tolerance_applied = true;

-- Afficher tous les agents personnalisés
SELECT 
    name as "Nom complet",
    email as "Email",
    tolerance_radius_meters as "Rayon (m)",
    ROUND(tolerance_radius_meters / 1000.0, 1) as "Rayon (km)",
    tolerance_source as "Zone",
    tolerance_commune as "Commune"
FROM users 
WHERE custom_tolerance_applied = true
ORDER BY tolerance_source, tolerance_radius_meters DESC;
