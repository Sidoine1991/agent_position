-- Script pour limiter les agents de la zone SUD à 20km maximum
-- Ajustement des rayons selon les déclarations individuelles

-- =====================================================
-- NOUVELLE CONFIGURATION ZONE SUD - MAXIMUM 20KM
-- =====================================================

-- Analyser les déclarations originales des agents SUD
-- Tous avaient déclaré 35km, donc 35km × 0.8 = 28km
-- Nouvelle limite : 20km maximum

-- 1. DAGNITO Mariano - Zogbodomey - 35km → 20km (20000m) - LIMITÉ
UPDATE users 
SET 
    tolerance_radius_meters = 20000,
    custom_tolerance_applied = true,
    tolerance_source = 'SUD',
    tolerance_commune = 'Zogbodomey'
WHERE email = 'damarubb@gmail.com';

-- 2. GOGAN Ida - Zogbodomey - 35km → 20km (20000m) - LIMITÉ
UPDATE users 
SET 
    tolerance_radius_meters = 20000,
    custom_tolerance_applied = true,
    tolerance_source = 'SUD',
    tolerance_commune = 'Zogbodomey'
WHERE email = 'idagogan16@gmail.com';

-- 3. ADJOVI COMLAN SABECK - Zogbodomey - 35km → 20km (20000m) - LIMITÉ
UPDATE users 
SET 
    tolerance_radius_meters = 20000,
    custom_tolerance_applied = true,
    tolerance_source = 'SUD',
    tolerance_commune = 'Zogbodomey'
WHERE email = 'adjovicomlansabeck123@gmail.com';

-- 4. TOGNON TCHEGNONSI BERNICE - Zogbodomey - 35km → 20km (20000m) - LIMITÉ
UPDATE users 
SET 
    tolerance_radius_meters = 20000,
    custom_tolerance_applied = true,
    tolerance_source = 'SUD',
    tolerance_commune = 'Zogbodomey'
WHERE email = 'bernice.tognon@gmail.com';

-- 5. TOGNISSOU LOCKE - Zogbodomey - 35km → 20km (20000m) - LIMITÉ
UPDATE users 
SET 
    tolerance_radius_meters = 20000,
    custom_tolerance_applied = true,
    tolerance_source = 'SUD',
    tolerance_commune = 'Zogbodomey'
WHERE email = 'tognissoulocke@gmail.com';

-- =====================================================
-- VÉRIFICATION DES MISE À JOUR ZONE SUD
-- =====================================================

-- Vérifier que tous les agents SUD ont été mis à jour
SELECT 
    'Zone SUD - Vérification' as "Type",
    name as "Nom complet",
    email as "Email",
    tolerance_radius_meters as "Rayon (m)",
    ROUND(tolerance_radius_meters / 1000.0, 1) as "Rayon (km)",
    tolerance_commune as "Commune",
    custom_tolerance_applied as "Personnalisé"
FROM users 
WHERE tolerance_source = 'SUD' AND custom_tolerance_applied = true
ORDER BY tolerance_radius_meters DESC;

-- =====================================================
-- STATISTIQUES MISE À JOUR
-- =====================================================

-- Statistiques par zone après modification
SELECT 
    tolerance_source as "Zone",
    COUNT(*) as "Nombre d'agents",
    AVG(tolerance_radius_meters) as "Rayon moyen (m)",
    MIN(tolerance_radius_meters) as "Rayon minimum (m)",
    MAX(tolerance_radius_meters) as "Rayon maximum (m)",
    ROUND(AVG(tolerance_radius_meters) / 1000.0, 1) as "Rayon moyen (km)",
    ROUND(MIN(tolerance_radius_meters) / 1000.0, 1) as "Rayon minimum (km)",
    ROUND(MAX(tolerance_radius_meters) / 1000.0, 1) as "Rayon maximum (km)"
FROM users 
WHERE tolerance_radius_meters IS NOT NULL
GROUP BY tolerance_source
ORDER BY tolerance_source;

-- =====================================================
-- VÉRIFICATION DES LIMITES
-- =====================================================

-- Vérifier qu'aucun rayon n'excède 30km (limite absolue)
SELECT 
    'Vérification limites' as "Type",
    COUNT(*) as "Agents avec rayon > 30km",
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ SUCCÈS: Aucun rayon > 30km'
        ELSE '⚠️ ATTENTION: ' || COUNT(*) || ' agents avec rayon > 30km'
    END as "Statut"
FROM users 
WHERE tolerance_radius_meters > 30000;

-- Vérifier que la zone SUD respecte la limite de 20km
SELECT 
    'Zone SUD - Limite 20km' as "Type",
    COUNT(*) as "Agents SUD avec rayon > 20km",
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ SUCCÈS: Tous les agents SUD ≤ 20km'
        ELSE '⚠️ ATTENTION: ' || COUNT(*) || ' agents SUD > 20km'
    END as "Statut"
FROM users 
WHERE tolerance_source = 'SUD' AND tolerance_radius_meters > 20000;

-- =====================================================
-- RÉSUMÉ FINAL
-- =====================================================

-- Afficher tous les agents avec leurs rayons finaux
SELECT 
    tolerance_source as "Zone",
    name as "Nom complet",
    email as "Email",
    tolerance_radius_meters as "Rayon (m)",
    ROUND(tolerance_radius_meters / 1000.0, 1) as "Rayon (km)",
    tolerance_commune as "Commune"
FROM users 
WHERE custom_tolerance_applied = true
ORDER BY tolerance_source, tolerance_radius_meters DESC;
