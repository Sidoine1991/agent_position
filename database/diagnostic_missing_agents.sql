-- Script de diagnostic pour identifier les agents manquants
-- Analyse détaillée de l'état actuel vs l'état attendu

-- =====================================================
-- DIAGNOSTIC DÉTAILLÉ DES AGENTS MANQUANTS
-- =====================================================

-- Créer une table temporaire avec les exigences exactes
CREATE TEMP TABLE expected_agents (
    agent_name TEXT,
    email TEXT,
    commune TEXT,
    zone TEXT,
    distance_declaree INTEGER,
    rayon_attendu INTEGER,
    rayon_attendu_km DECIMAL(5,1)
);

-- Insérer toutes les exigences
INSERT INTO expected_agents VALUES
-- Zone PDA4
('DJIBRIL ABDEL-HAFIZ', 'abdelhafizdjibril@gmail.com', 'DJOUGOU', 'PDA4', 25, 20000, 20.0),
('GOUKALODE CALIXTE', 'calixtegoukalode60@gmail.com', 'DASSA-ZOUMÉ', 'PDA4', 22, 17600, 17.6),
('EKPA CHABI OGOUDÉLÉ AIMÉ', 'ekpaaime64@gmail.com', 'BASSILA', 'PDA4', 20, 16000, 16.0),
('KALOA Moukimiou', 'kaloamoukimiou@gmail.com', 'OUAKÉ', 'PDA4', 25, 20000, 20.0),
('CHERIF FABADE DEKANDE LUC', 'lucherifabade@gmail.com', 'SAVALOU', 'PDA4', 30, 24000, 24.0),
('FADO Kami Macaire', 'macairefado18@gmail.com', 'BANTÈ', 'PDA4', 15, 12000, 12.0),
('TCHETAN Liwan Prudence', 'prudo1980@gmail.com', 'GLAZOUE', 'PDA4', 10, 8000, 8.0),
('AKPO BABATOUNDÉ SADRESSE ANOS', 'anosakpo@gmail.com', 'DASSA ZOUMÈ', 'PDA4', 21, 16800, 16.8),
('DAGAN Bruno', 'brunedage@gmail.com', 'Glazoué', 'PDA4', 25, 20000, 20.0),
('ADOHO THIBURCE', 'thiburce976@gmail.com', 'SAVALOU', 'PDA4', 55, 30000, 30.0),
('SERIKI FATAÏ', 'fataiseriki01@gmail.com', 'BANTÉ', 'PDA4', 22, 17600, 17.6),

-- Zone SUD
('DAGNITO Mariano', 'damarubb@gmail.com', 'Zogbodomey', 'SUD', 35, 28000, 28.0),
('GOGAN Ida', 'idagogan16@gmail.com', 'Zogbodomey', 'SUD', 35, 28000, 28.0),
('ADJOVI COMLAN SABECK', 'adjovicomlansabeck123@gmail.com', 'Zogbodomey', 'SUD', 35, 28000, 28.0),
('TOGNON TCHEGNONSI BERNICE', 'bernice.tognon@gmail.com', 'Zogbodomey', 'SUD', 35, 28000, 28.0);

-- =====================================================
-- ANALYSE DÉTAILLÉE PAR AGENT
-- =====================================================

-- Comparaison détaillée agent par agent
SELECT 
    ea.agent_name as "Agent",
    ea.email as "Email",
    ea.commune as "Commune",
    ea.zone as "Zone",
    ea.rayon_attendu_km as "Rayon attendu (km)",
    COALESCE(u.tolerance_radius_meters, 0) as "Rayon actuel (m)",
    ROUND(COALESCE(u.tolerance_radius_meters, 0) / 1000.0, 1) as "Rayon actuel (km)",
    COALESCE(u.custom_tolerance_applied, false) as "Personnalisé",
    COALESCE(u.tolerance_source, 'NULL') as "Source actuelle",
    CASE 
        WHEN u.tolerance_radius_meters IS NULL THEN '❌ AGENT NON TROUVÉ'
        WHEN u.tolerance_radius_meters = ea.rayon_attendu THEN '✅ CORRECT'
        WHEN u.tolerance_radius_meters = 6000 THEN '⚠️ RAYON PAR DÉFAUT'
        WHEN u.custom_tolerance_applied = true AND u.tolerance_radius_meters != ea.rayon_attendu THEN '❌ RAYON INCORRECT'
        ELSE '❓ ÉTAT INCONNU'
    END as "Statut"
FROM expected_agents ea
LEFT JOIN users u ON ea.email = u.email
ORDER BY ea.zone, ea.agent_name;

-- =====================================================
-- RÉSUMÉ PAR STATUT
-- =====================================================

-- Compter les agents par statut
SELECT 
    'Résumé par statut' as "Type",
    COUNT(*) as "Total attendu",
    COUNT(CASE WHEN u.tolerance_radius_meters = ea.rayon_attendu THEN 1 END) as "✅ Corrects",
    COUNT(CASE WHEN u.tolerance_radius_meters = 6000 THEN 1 END) as "⚠️ Rayon par défaut",
    COUNT(CASE WHEN u.tolerance_radius_meters IS NULL THEN 1 END) as "❌ Non trouvés",
    COUNT(CASE WHEN u.tolerance_radius_meters != ea.rayon_attendu AND u.tolerance_radius_meters != 6000 THEN 1 END) as "❌ Incorrects"
FROM expected_agents ea
LEFT JOIN users u ON ea.email = u.email;

-- =====================================================
-- AGENTS À CORRIGER
-- =====================================================

-- Lister spécifiquement les agents qui ont besoin d'être corrigés
SELECT 
    'Agents à corriger' as "Type",
    ea.agent_name as "Agent",
    ea.email as "Email",
    ea.rayon_attendu as "Rayon attendu (m)",
    ea.rayon_attendu_km as "Rayon attendu (km)",
    COALESCE(u.tolerance_radius_meters, 0) as "Rayon actuel (m)",
    CASE 
        WHEN u.tolerance_radius_meters IS NULL THEN 'AGENT NON TROUVÉ'
        WHEN u.tolerance_radius_meters = 6000 THEN 'RAYON PAR DÉFAUT'
        ELSE 'RAYON INCORRECT'
    END as "Problème"
FROM expected_agents ea
LEFT JOIN users u ON ea.email = u.email
WHERE u.tolerance_radius_meters IS NULL 
   OR u.tolerance_radius_meters = 6000 
   OR u.tolerance_radius_meters != ea.rayon_attendu
ORDER BY ea.zone, ea.agent_name;

-- =====================================================
-- GÉNÉRATION DU SCRIPT DE CORRECTION
-- =====================================================

-- Générer automatiquement les commandes UPDATE pour les agents manquants
SELECT 
    '-- Script de correction généré automatiquement' as "Script",
    '-- Agent: ' || ea.agent_name as "Commentaire",
    'UPDATE users SET tolerance_radius_meters = ' || ea.rayon_attendu || ', custom_tolerance_applied = true, tolerance_source = ''' || ea.zone || ''', tolerance_commune = ''' || ea.commune || ''' WHERE email = ''' || ea.email || ''';' as "Commande"
FROM expected_agents ea
LEFT JOIN users u ON ea.email = u.email
WHERE u.tolerance_radius_meters IS NULL 
   OR u.tolerance_radius_meters = 6000 
   OR u.tolerance_radius_meters != ea.rayon_attendu
ORDER BY ea.zone, ea.agent_name;

-- Nettoyer la table temporaire
DROP TABLE expected_agents;
