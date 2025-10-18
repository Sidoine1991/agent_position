-- Script de vérification finale après correction des rayons de tolérance
-- Confirmation que tous les agents ont été correctement mis à jour

-- =====================================================
-- VÉRIFICATION COMPLÈTE DES RAYONS DE TOLÉRANCE
-- =====================================================

-- 1. Agents PDA4 avec rayons personnalisés
SELECT 
    'Zone PDA4' as "Zone",
    name as "Nom complet",
    email as "Email",
    tolerance_radius_meters as "Rayon (m)",
    ROUND(tolerance_radius_meters / 1000.0, 1) as "Rayon (km)",
    tolerance_commune as "Commune",
    custom_tolerance_applied as "Personnalisé"
FROM users 
WHERE tolerance_source = 'PDA4' AND custom_tolerance_applied = true
ORDER BY tolerance_radius_meters DESC;

-- 2. Agents SUD avec rayons personnalisés
SELECT 
    'Zone SUD' as "Zone",
    name as "Nom complet",
    email as "Email",
    tolerance_radius_meters as "Rayon (m)",
    ROUND(tolerance_radius_meters / 1000.0, 1) as "Rayon (km)",
    tolerance_commune as "Commune",
    custom_tolerance_applied as "Personnalisé"
FROM users 
WHERE tolerance_source = 'SUD' AND custom_tolerance_applied = true
ORDER BY tolerance_radius_meters DESC;

-- 3. Agents avec rayon par défaut (devraient être les autres)
SELECT 
    'Rayon par défaut' as "Type",
    name as "Nom complet",
    email as "Email",
    tolerance_radius_meters as "Rayon (m)",
    ROUND(tolerance_radius_meters / 1000.0, 1) as "Rayon (km)",
    tolerance_source as "Source",
    tolerance_commune as "Commune"
FROM users 
WHERE tolerance_radius_meters = 6000 AND custom_tolerance_applied = false
ORDER BY name;

-- =====================================================
-- STATISTIQUES FINALES
-- =====================================================

-- Statistiques par zone
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
-- VÉRIFICATION DE CONFORMITÉ
-- =====================================================

-- Compter les agents par type de rayon
SELECT 
    'Résumé final' as "Type",
    COUNT(*) as "Total agents",
    COUNT(CASE WHEN custom_tolerance_applied = true THEN 1 END) as "Agents personnalisés",
    COUNT(CASE WHEN custom_tolerance_applied = false AND tolerance_radius_meters = 6000 THEN 1 END) as "Agents par défaut (6km)",
    COUNT(CASE WHEN tolerance_source = 'PDA4' THEN 1 END) as "Zone PDA4",
    COUNT(CASE WHEN tolerance_source = 'SUD' THEN 1 END) as "Zone SUD",
    COUNT(CASE WHEN tolerance_source = 'default' THEN 1 END) as "Zone par défaut"
FROM users 
WHERE tolerance_radius_meters IS NOT NULL;

-- =====================================================
-- VÉRIFICATION DES VALEURS ÉLEVÉES
-- =====================================================

-- Vérifier qu'il n'y a plus de rayons > 40km
SELECT 
    'Vérification rayons élevés' as "Type",
    COUNT(*) as "Agents avec rayon > 40km",
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ SUCCÈS: Aucun rayon > 40km'
        ELSE '⚠️ ATTENTION: ' || COUNT(*) || ' agents avec rayon > 40km'
    END as "Statut"
FROM users 
WHERE tolerance_radius_meters > 40000;

-- Afficher les 5 rayons les plus élevés
SELECT 
    'Top 5 rayons les plus élevés' as "Type",
    name as "Agent",
    ROUND(tolerance_radius_meters / 1000.0, 1) as "Rayon (km)",
    tolerance_commune as "Commune",
    tolerance_source as "Zone"
FROM users 
WHERE tolerance_radius_meters IS NOT NULL
ORDER BY tolerance_radius_meters DESC
LIMIT 5;

-- =====================================================
-- MESSAGE DE CONFIRMATION
-- =====================================================

-- Message final de confirmation
SELECT 
    'CONFIRMATION FINALE' as "Type",
    CASE 
        WHEN COUNT(CASE WHEN custom_tolerance_applied = true THEN 1 END) >= 15 THEN 
            '🎉 SUCCÈS: Tous les agents ont été correctement configurés!'
        ELSE 
            '⚠️ ATTENTION: ' || (15 - COUNT(CASE WHEN custom_tolerance_applied = true THEN 1 END)) || ' agents manquants'
    END as "Message"
FROM users 
WHERE tolerance_radius_meters IS NOT NULL;
