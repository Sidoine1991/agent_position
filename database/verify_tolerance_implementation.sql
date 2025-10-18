-- Script de vérification de l'implémentation des rayons de tolérance
-- Comparaison avec les exigences initiales

-- =====================================================
-- VÉRIFICATION DES AGENTS PERSONNALISÉS
-- =====================================================

-- Zone PDA4 (Nord) - Agents avec rayons personnalisés
SELECT 
    'Zone PDA4 - Agents personnalisés' as "Groupe",
    name as "Nom complet",
    email as "Email",
    tolerance_radius_meters as "Rayon actuel (m)",
    ROUND(tolerance_radius_meters / 1000.0, 1) as "Rayon actuel (km)",
    tolerance_source as "Source",
    tolerance_commune as "Commune",
    custom_tolerance_applied as "Personnalisé"
FROM users 
WHERE tolerance_source = 'PDA4' AND custom_tolerance_applied = true
ORDER BY tolerance_radius_meters DESC;

-- Zone SUD - Agents avec rayons personnalisés
SELECT 
    'Zone SUD - Agents personnalisés' as "Groupe",
    name as "Nom complet",
    email as "Email",
    tolerance_radius_meters as "Rayon actuel (m)",
    ROUND(tolerance_radius_meters / 1000.0, 1) as "Rayon actuel (km)",
    tolerance_source as "Source",
    tolerance_commune as "Commune",
    custom_tolerance_applied as "Personnalisé"
FROM users 
WHERE tolerance_source = 'SUD' AND custom_tolerance_applied = true
ORDER BY tolerance_radius_meters DESC;

-- =====================================================
-- COMPARAISON AVEC LES EXIGENCES INITIALES
-- =====================================================

-- Créer une table temporaire avec les exigences
CREATE TEMP TABLE expected_tolerance (
    agent_name TEXT,
    commune TEXT,
    zone TEXT,
    distance_declaree INTEGER,
    rayon_attendu INTEGER,
    email TEXT
);

-- Insérer les exigences PDA4
INSERT INTO expected_tolerance VALUES
('DJIBRIL ABDEL-HAFIZ', 'DJOUGOU', 'PDA4', 25, 20000, 'abdelhafizdjibril@gmail.com'),
('GOUKALODE CALIXTE', 'DASSA-ZOUMÉ', 'PDA4', 22, 17600, 'calixtegoukalode60@gmail.com'),
('EKPA Chabi Ogoudélé Aimé', 'BASSILA', 'PDA4', 20, 16000, 'ekpaaime64@gmail.com'),
('KALOA Moukimiou', 'OUAKÉ', 'PDA4', 25, 20000, 'kaloamoukimiou@gmail.com'),
('CHERIF FABADE DEKANDE LUC', 'SAVALOU', 'PDA4', 30, 24000, 'lucherifabade@gmail.com'),
('FADO kami Macaire', 'BANTÈ', 'PDA4', 15, 12000, 'macairefado18@gmail.com'),
('TCHETAN PRUDENCE', 'GLAZOUE', 'PDA4', 10, 8000, 'prudo1980@gmail.com'),
('AKPO ANOS', 'DASSA ZOUMÈ', 'PDA4', 21, 16800, 'anosakpo@gmail.com'),
('DAGAN Bruno', 'Glazoué', 'PDA4', 25, 20000, 'brunedage@gmail.com'),
('ADOHO D. THIBURCE', 'SAVALOU', 'PDA4', 55, 30000, 'thiburce976@gmail.com'), -- LIMITÉ À 30km
('SERIKI FATAI', 'BANTÉ', 'PDA4', 22, 17600, 'fataiseriki01@gmail.com');

-- Insérer les exigences SUD
INSERT INTO expected_tolerance VALUES
('DAGNITO Mariano', 'Zogbodomey', 'SUD', 35, 28000, 'damarubb@gmail.com'),
('GOGAN Ida', 'Zogbodomey', 'SUD', 35, 28000, 'idagogan16@gmail.com'),
('ADJOVI Sabeck', 'Zogbodomey', 'SUD', 35, 28000, 'adjovicomlansabeck123@gmail.com'),
('TOGNON TCHEGNONSI Bernice', 'Zogbodomey', 'SUD', 35, 28000, 'bernice.tognon@gmail.com');

-- =====================================================
-- COMPARAISON DÉTAILLÉE
-- =====================================================

-- Comparer les rayons actuels avec les exigences
SELECT 
    et.agent_name as "Agent",
    et.commune as "Commune",
    et.zone as "Zone",
    et.distance_declaree as "Distance déclarée (km)",
    et.rayon_attendu as "Rayon attendu (m)",
    ROUND(et.rayon_attendu / 1000.0, 1) as "Rayon attendu (km)",
    COALESCE(u.tolerance_radius_meters, 0) as "Rayon actuel (m)",
    ROUND(COALESCE(u.tolerance_radius_meters, 0) / 1000.0, 1) as "Rayon actuel (km)",
    CASE 
        WHEN u.tolerance_radius_meters IS NULL THEN '❌ NON TROUVÉ'
        WHEN u.tolerance_radius_meters = et.rayon_attendu THEN '✅ CORRECT'
        WHEN u.tolerance_radius_meters = 6000 THEN '⚠️ RAYON PAR DÉFAUT'
        ELSE '❌ INCORRECT'
    END as "Statut"
FROM expected_tolerance et
LEFT JOIN users u ON et.email = u.email
ORDER BY et.zone, et.agent_name;

-- =====================================================
-- AGENTS AVEC RAYON PAR DÉFAUT (6000m)
-- =====================================================

-- Identifier les agents qui devraient avoir des rayons personnalisés mais ont le rayon par défaut
SELECT 
    'Agents avec rayon par défaut (6000m)' as "Groupe",
    name as "Nom complet",
    email as "Email",
    tolerance_radius_meters as "Rayon actuel (m)",
    tolerance_source as "Source",
    tolerance_commune as "Commune",
    custom_tolerance_applied as "Personnalisé"
FROM users 
WHERE tolerance_radius_meters = 6000 
  AND custom_tolerance_applied = false
  AND tolerance_source = 'default'
ORDER BY name;

-- =====================================================
-- STATISTIQUES GLOBALES
-- =====================================================

-- Statistiques par source
SELECT 
    tolerance_source as "Source",
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
-- RÉSUMÉ DE CONFORMITÉ
-- =====================================================

-- Compter les agents conformes vs non conformes
SELECT 
    'Résumé de conformité' as "Type",
    COUNT(*) as "Total agents attendus",
    COUNT(CASE WHEN u.tolerance_radius_meters = et.rayon_attendu THEN 1 END) as "Agents conformes",
    COUNT(CASE WHEN u.tolerance_radius_meters IS NULL THEN 1 END) as "Agents non trouvés",
    COUNT(CASE WHEN u.tolerance_radius_meters = 6000 THEN 1 END) as "Agents avec rayon par défaut",
    COUNT(CASE WHEN u.tolerance_radius_meters != et.rayon_attendu AND u.tolerance_radius_meters != 6000 THEN 1 END) as "Agents incorrects",
    ROUND(COUNT(CASE WHEN u.tolerance_radius_meters = et.rayon_attendu THEN 1 END) * 100.0 / COUNT(*), 1) as "Taux de conformité (%)"
FROM expected_tolerance et
LEFT JOIN users u ON et.email = u.email;

-- Nettoyer la table temporaire
DROP TABLE expected_tolerance;
