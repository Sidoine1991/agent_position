-- Script de test pour vérifier que toutes nos valeurs de tolérance sont acceptées
-- Exécuter ce script après fix_tolerance_constraint.sql

-- =====================================================
-- TEST DE TOUTES LES VALEURS DE TOLÉRANCE
-- =====================================================

-- Créer une table temporaire pour tester nos valeurs
CREATE TEMP TABLE test_tolerance_values (
    agent_name TEXT,
    rayon_meters INTEGER,
    rayon_km DECIMAL(5,1),
    zone TEXT,
    commune TEXT
);

-- Insérer toutes nos valeurs de test
INSERT INTO test_tolerance_values VALUES
-- Zone PDA4 (Nord)
('DJIBRIL ABDEL-HAFIZ', 20000, 20.0, 'PDA4', 'DJOUGOU'),
('GOUKALODE CALIXTE', 17600, 17.6, 'PDA4', 'DASSA-ZOUMÉ'),
('EKPA Chabi Ogoudélé Aimé', 16000, 16.0, 'PDA4', 'BASSILA'),
('KALOA Moukimiou', 20000, 20.0, 'PDA4', 'OUAKÉ'),
('CHERIF FABADE DEKANDE LUC', 24000, 24.0, 'PDA4', 'SAVALOU'),
('FADO kami Macaire', 12000, 12.0, 'PDA4', 'BANTÈ'),
('TCHETAN PRUDENCE', 8000, 8.0, 'PDA4', 'GLAZOUE'),
('AKPO ANOS', 16800, 16.8, 'PDA4', 'DASSA ZOUMÈ'),
('DAGAN Bruno', 20000, 20.0, 'PDA4', 'Glazoué'),
('ADOHO D. THIBURCE', 30000, 30.0, 'PDA4', 'SAVALOU'),
('SERIKI FATAI', 17600, 17.6, 'PDA4', 'BANTÉ'),

-- Zone SUD
('DAGNITO Mariano', 28000, 28.0, 'SUD', 'Zogbodomey'),
('GOGAN Ida', 28000, 28.0, 'SUD', 'Zogbodomey'),
('ADJOVI Sabeck', 28000, 28.0, 'SUD', 'Zogbodomey'),
('TOGNON TCHEGNONSI Bernice', 28000, 28.0, 'SUD', 'Zogbodomey'),

-- Valeurs par défaut
('Agent par défaut', 6000, 6.0, 'default', 'Non spécifié');

-- =====================================================
-- VÉRIFICATION DES CONTRAINTES
-- =====================================================

-- Tester chaque valeur contre la contrainte
SELECT 
    agent_name as "Agent",
    rayon_meters as "Rayon (m)",
    rayon_km as "Rayon (km)",
    zone as "Zone",
    commune as "Commune",
    CASE 
        WHEN rayon_meters >= 100 AND rayon_meters <= 100000 THEN '✅ OK'
        ELSE '❌ PROBLÈME'
    END as "Statut contrainte"
FROM test_tolerance_values
ORDER BY rayon_meters DESC;

-- =====================================================
-- STATISTIQUES
-- =====================================================

-- Statistiques par zone
SELECT 
    zone as "Zone",
    COUNT(*) as "Nombre d'agents",
    MIN(rayon_meters) as "Rayon minimum (m)",
    MAX(rayon_meters) as "Rayon maximum (m)",
    AVG(rayon_meters) as "Rayon moyen (m)",
    ROUND(AVG(rayon_km), 1) as "Rayon moyen (km)"
FROM test_tolerance_values
GROUP BY zone
ORDER BY zone;

-- =====================================================
-- VÉRIFICATION DES VALEURS PROBLÉMATIQUES
-- =====================================================

-- Identifier les valeurs qui pourraient poser problème
SELECT 
    agent_name as "Agent problématique",
    rayon_meters as "Rayon (m)",
    rayon_km as "Rayon (km)",
    CASE 
        WHEN rayon_meters > 50000 THEN '⚠️ Très élevé (>50km)'
        WHEN rayon_meters > 30000 THEN '⚠️ Élevé (>30km)'
        WHEN rayon_meters < 1000 THEN '⚠️ Très faible (<1km)'
        ELSE '✅ Normal'
    END as "Avertissement"
FROM test_tolerance_values
WHERE rayon_meters > 30000 OR rayon_meters < 1000
ORDER BY rayon_meters DESC;

-- =====================================================
-- TEST DE SIMULATION D'INSERTION
-- =====================================================

-- Simuler l'insertion de nos valeurs (sans vraiment les insérer)
SELECT 
    'Simulation d''insertion' as "Test",
    COUNT(*) as "Valeurs testées",
    COUNT(CASE WHEN rayon_meters >= 100 AND rayon_meters <= 100000 THEN 1 END) as "Valeurs acceptées",
    COUNT(CASE WHEN rayon_meters < 100 OR rayon_meters > 100000 THEN 1 END) as "Valeurs rejetées"
FROM test_tolerance_values;

-- =====================================================
-- RECOMMANDATIONS
-- =====================================================

-- Afficher les recommandations
SELECT 
    'Recommandations' as "Type",
    CASE 
        WHEN MAX(rayon_meters) > 50000 THEN 'Considérer une limite supérieure plus élevée (ex: 100km)'
        WHEN MAX(rayon_meters) > 30000 THEN 'Valeurs élevées détectées - vérifier la logique métier'
        ELSE 'Toutes les valeurs sont dans une plage acceptable'
    END as "Message"
FROM test_tolerance_values;

-- Nettoyer la table temporaire
DROP TABLE test_tolerance_values;
