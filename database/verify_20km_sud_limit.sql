-- Script de vérification de la limite 20km pour la zone SUD
-- Confirmation que tous les agents SUD respectent la nouvelle limite

-- =====================================================
-- VÉRIFICATION ZONE SUD - LIMITE 20KM
-- =====================================================

-- Vérifier que tous les agents SUD ont un rayon ≤ 20km
SELECT 
    'Zone SUD - Vérification limite 20km' as "Type",
    name as "Nom complet",
    email as "Email",
    tolerance_radius_meters as "Rayon (m)",
    ROUND(tolerance_radius_meters / 1000.0, 1) as "Rayon (km)",
    tolerance_commune as "Commune",
    CASE 
        WHEN tolerance_radius_meters <= 20000 THEN '✅ CONFORME'
        ELSE '❌ NON CONFORME'
    END as "Statut"
FROM users 
WHERE tolerance_source = 'SUD' AND custom_tolerance_applied = true
ORDER BY tolerance_radius_meters DESC;

-- =====================================================
-- STATISTIQUES GLOBALES MISE À JOUR
-- =====================================================

-- Statistiques par zone avec les nouvelles limites
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
-- VÉRIFICATION DES LIMITES MÉTIER
-- =====================================================

-- Vérifier qu'aucun rayon n'excède 30km (limite absolue)
SELECT 
    'Limite absolue 30km' as "Type",
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
-- RÉSUMÉ COMPLET
-- =====================================================

-- Afficher tous les agents avec leurs rayons finaux
SELECT 
    tolerance_source as "Zone",
    name as "Nom complet",
    email as "Email",
    tolerance_radius_meters as "Rayon (m)",
    ROUND(tolerance_radius_meters / 1000.0, 1) as "Rayon (km)",
    tolerance_commune as "Commune",
    CASE 
        WHEN tolerance_source = 'SUD' AND tolerance_radius_meters <= 20000 THEN '✅ CONFORME'
        WHEN tolerance_source = 'PDA4' AND tolerance_radius_meters <= 30000 THEN '✅ CONFORME'
        WHEN tolerance_source = 'default' THEN '✅ PAR DÉFAUT'
        ELSE '❌ NON CONFORME'
    END as "Statut"
FROM users 
WHERE custom_tolerance_applied = true
ORDER BY tolerance_source, tolerance_radius_meters DESC;

-- =====================================================
-- MESSAGE DE CONFIRMATION FINALE
-- =====================================================

-- Message final de confirmation
SELECT 
    'CONFIRMATION FINALE - LIMITES MÉTIER' as "Type",
    CASE 
        WHEN COUNT(CASE WHEN tolerance_source = 'SUD' AND tolerance_radius_meters > 20000 THEN 1 END) = 0 
         AND COUNT(CASE WHEN tolerance_radius_meters > 30000 THEN 1 END) = 0 THEN 
            '🎉 SUCCÈS: Toutes les limites métier sont respectées!'
        ELSE 
            '⚠️ ATTENTION: Certaines limites ne sont pas respectées'
    END as "Message"
FROM users 
WHERE tolerance_radius_meters IS NOT NULL;
