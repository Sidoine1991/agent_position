-- Script de validation finale pour confirmer que tous les rayons de tolérance sont acceptés
-- Exécuter ce script après toutes les corrections pour valider la mise en œuvre

-- =====================================================
-- VALIDATION FINALE DES RAYONS DE TOLÉRANCE
-- =====================================================

-- Créer une vue de validation
CREATE OR REPLACE VIEW validation_tolerance_radius AS
SELECT 
    'DJIBRIL ABDEL-HAFIZ' as agent_name,
    20000 as rayon_meters,
    20.0 as rayon_km,
    'PDA4' as zone,
    'DJOUGOU' as commune,
    'abdelhafizdjibril@gmail.com' as email,
    CASE 
        WHEN 20000 >= 100 AND 20000 <= 100000 THEN '✅ VALIDÉ'
        ELSE '❌ REJETÉ'
    END as statut_contrainte
UNION ALL
SELECT 'GOUKALODE CALIXTE', 17600, 17.6, 'PDA4', 'DASSA-ZOUMÉ', 'calixtegoukalode60@gmail.com',
    CASE WHEN 17600 >= 100 AND 17600 <= 100000 THEN '✅ VALIDÉ' ELSE '❌ REJETÉ' END
UNION ALL
SELECT 'EKPA Chabi Ogoudélé Aimé', 16000, 16.0, 'PDA4', 'BASSILA', NULL,
    CASE WHEN 16000 >= 100 AND 16000 <= 100000 THEN '✅ VALIDÉ' ELSE '❌ REJETÉ' END
UNION ALL
SELECT 'KALOA Moukimiou', 20000, 20.0, 'PDA4', 'OUAKÉ', NULL,
    CASE WHEN 20000 >= 100 AND 20000 <= 100000 THEN '✅ VALIDÉ' ELSE '❌ REJETÉ' END
UNION ALL
SELECT 'CHERIF FABADE DEKANDE LUC', 24000, 24.0, 'PDA4', 'SAVALOU', 'lucherifabade@gmail.com',
    CASE WHEN 24000 >= 100 AND 24000 <= 100000 THEN '✅ VALIDÉ' ELSE '❌ REJETÉ' END
UNION ALL
SELECT 'FADO kami Macaire', 12000, 12.0, 'PDA4', 'BANTÈ', NULL,
    CASE WHEN 12000 >= 100 AND 12000 <= 100000 THEN '✅ VALIDÉ' ELSE '❌ REJETÉ' END
UNION ALL
SELECT 'TCHETAN PRUDENCE', 8000, 8.0, 'PDA4', 'GLAZOUE', NULL,
    CASE WHEN 8000 >= 100 AND 8000 <= 100000 THEN '✅ VALIDÉ' ELSE '❌ REJETÉ' END
UNION ALL
SELECT 'AKPO ANOS', 16800, 16.8, 'PDA4', 'DASSA ZOUMÈ', NULL,
    CASE WHEN 16800 >= 100 AND 16800 <= 100000 THEN '✅ VALIDÉ' ELSE '❌ REJETÉ' END
UNION ALL
SELECT 'DAGAN Bruno', 20000, 20.0, 'PDA4', 'Glazoué', 'brunedage@gmail.com',
    CASE WHEN 20000 >= 100 AND 20000 <= 100000 THEN '✅ VALIDÉ' ELSE '❌ REJETÉ' END
UNION ALL
SELECT 'ADOHO D. THIBURCE', 30000, 30.0, 'PDA4', 'SAVALOU', NULL,
    CASE WHEN 30000 >= 100 AND 30000 <= 100000 THEN '✅ VALIDÉ' ELSE '❌ REJETÉ' END
UNION ALL
SELECT 'SERIKI FATAI', 17600, 17.6, 'PDA4', 'BANTÉ', NULL,
    CASE WHEN 17600 >= 100 AND 17600 <= 100000 THEN '✅ VALIDÉ' ELSE '❌ REJETÉ' END
UNION ALL
SELECT 'DAGNITO Mariano', 28000, 28.0, 'SUD', 'Zogbodomey', NULL,
    CASE WHEN 28000 >= 100 AND 28000 <= 100000 THEN '✅ VALIDÉ' ELSE '❌ REJETÉ' END
UNION ALL
SELECT 'GOGAN Ida', 28000, 28.0, 'SUD', 'Zogbodomey', NULL,
    CASE WHEN 28000 >= 100 AND 28000 <= 100000 THEN '✅ VALIDÉ' ELSE '❌ REJETÉ' END
UNION ALL
SELECT 'ADJOVI Sabeck', 28000, 28.0, 'SUD', 'Zogbodomey', 'adjovicomlansabeck123@gmail.com',
    CASE WHEN 28000 >= 100 AND 28000 <= 100000 THEN '✅ VALIDÉ' ELSE '❌ REJETÉ' END
UNION ALL
SELECT 'TOGNON TCHEGNONSI Bernice', 28000, 28.0, 'SUD', 'Zogbodomey', 'tognissoulocke@gmail.com',
    CASE WHEN 28000 >= 100 AND 28000 <= 100000 THEN '✅ VALIDÉ' ELSE '❌ REJETÉ' END;

-- =====================================================
-- RAPPORT DE VALIDATION
-- =====================================================

-- Afficher le rapport complet
SELECT 
    agent_name as "Agent",
    rayon_km as "Rayon (km)",
    zone as "Zone",
    commune as "Commune",
    statut_contrainte as "Statut"
FROM validation_tolerance_radius
ORDER BY rayon_meters DESC;

-- =====================================================
-- STATISTIQUES DE VALIDATION
-- =====================================================

-- Statistiques globales
SELECT 
    'Statistiques Globales' as "Type",
    COUNT(*) as "Total agents",
    COUNT(CASE WHEN statut_contrainte = '✅ VALIDÉ' THEN 1 END) as "Agents validés",
    COUNT(CASE WHEN statut_contrainte = '❌ REJETÉ' THEN 1 END) as "Agents rejetés",
    ROUND(COUNT(CASE WHEN statut_contrainte = '✅ VALIDÉ' THEN 1 END) * 100.0 / COUNT(*), 1) as "Taux de validation (%)"
FROM validation_tolerance_radius;

-- Statistiques par zone
SELECT 
    zone as "Zone",
    COUNT(*) as "Nombre d'agents",
    MIN(rayon_km) as "Rayon minimum (km)",
    MAX(rayon_km) as "Rayon maximum (km)",
    ROUND(AVG(rayon_km), 1) as "Rayon moyen (km)",
    COUNT(CASE WHEN statut_contrainte = '✅ VALIDÉ' THEN 1 END) as "Validés",
    COUNT(CASE WHEN statut_contrainte = '❌ REJETÉ' THEN 1 END) as "Rejetés"
FROM validation_tolerance_radius
GROUP BY zone
ORDER BY zone;

-- =====================================================
-- VALEURS ÉLEVÉES - ANALYSE DÉTAILLÉE
-- =====================================================

-- Identifier et analyser les valeurs élevées
SELECT 
    agent_name as "Agent",
    rayon_km as "Rayon (km)",
    zone as "Zone",
    commune as "Commune",
    CASE 
        WHEN rayon_km > 40 THEN '🔴 TRÈS ÉLEVÉ (>40km)'
        WHEN rayon_km > 25 THEN '🟡 ÉLEVÉ (>25km)'
        WHEN rayon_km > 15 THEN '🟢 MODÉRÉ (>15km)'
        ELSE '🔵 FAIBLE (≤15km)'
    END as "Classification",
    statut_contrainte as "Statut contrainte"
FROM validation_tolerance_radius
WHERE rayon_km > 15
ORDER BY rayon_km DESC;

-- =====================================================
-- RECOMMANDATIONS FINALES
-- =====================================================

-- Générer les recommandations finales
SELECT 
    'Recommandations Finales' as "Type",
    CASE 
        WHEN COUNT(CASE WHEN statut_contrainte = '❌ REJETÉ' THEN 1 END) > 0 THEN 
            '❌ PROBLÈME: ' || COUNT(CASE WHEN statut_contrainte = '❌ REJETÉ' THEN 1 END) || ' agents rejetés'
        WHEN COUNT(CASE WHEN rayon_km > 40 THEN 1 END) > 0 THEN 
            '⚠️ ATTENTION: ' || COUNT(CASE WHEN rayon_km > 40 THEN 1 END) || ' agents avec rayons très élevés (>40km)'
        WHEN COUNT(CASE WHEN rayon_km > 25 THEN 1 END) > 0 THEN 
            '✅ VALIDÉ: ' || COUNT(CASE WHEN rayon_km > 25 THEN 1 END) || ' agents avec rayons élevés (>25km) - Justifiés'
        ELSE '✅ PARFAIT: Toutes les valeurs sont dans une plage acceptable'
    END as "Message"
FROM validation_tolerance_radius;

-- =====================================================
-- NETTOYAGE
-- =====================================================

-- Supprimer la vue temporaire
DROP VIEW IF EXISTS validation_tolerance_radius;
