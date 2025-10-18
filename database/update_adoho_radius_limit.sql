-- Script spécifique pour limiter le rayon d'ADOHO D. THIBURCE à 30km
-- Décision métier : Éviter les rayons excessifs (>40km)

-- =====================================================
-- MISE À JOUR SPÉCIFIQUE - ADOHO D. THIBURCE
-- =====================================================

-- Vérifier la valeur actuelle
SELECT 
    id,
    CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')) as "Nom complet",
    email as "Email",
    tolerance_radius_meters as "Rayon actuel (m)",
    ROUND(tolerance_radius_meters / 1000.0, 1) as "Rayon actuel (km)",
    tolerance_source as "Zone",
    tolerance_commune as "Commune"
FROM users 
WHERE LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%adoho%thiburce%'
   OR LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%thiburce%adoho%'
   OR LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%adoho%d%';

-- =====================================================
-- MISE À JOUR DU RAYON
-- =====================================================

-- Mettre à jour ADOHO D. THIBURCE avec le rayon limité à 30km
UPDATE users 
SET 
    tolerance_radius_meters = 30000, -- 30km au lieu de 44km
    custom_tolerance_applied = true,
    tolerance_source = 'PDA4',
    tolerance_commune = 'SAVALOU'
WHERE LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%adoho%thiburce%'
   OR LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%thiburce%adoho%'
   OR LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%adoho%d%';

-- =====================================================
-- VÉRIFICATION DE LA MISE À JOUR
-- =====================================================

-- Vérifier que la mise à jour a été effectuée
SELECT 
    id,
    CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')) as "Nom complet",
    email as "Email",
    tolerance_radius_meters as "Nouveau rayon (m)",
    ROUND(tolerance_radius_meters / 1000.0, 1) as "Nouveau rayon (km)",
    tolerance_source as "Zone",
    tolerance_commune as "Commune",
    custom_tolerance_applied as "Personnalisé"
FROM users 
WHERE LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%adoho%thiburce%'
   OR LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%thiburce%adoho%'
   OR LOWER(TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))) LIKE '%adoho%d%';

-- =====================================================
-- STATISTIQUES MISE À JOUR
-- =====================================================

-- Afficher les statistiques mises à jour
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
-- VÉRIFICATION DES VALEURS ÉLEVÉES
-- =====================================================

-- Vérifier qu'il n'y a plus de rayons > 40km
SELECT 
    COUNT(*) as "Agents avec rayon > 40km",
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ SUCCÈS: Aucun rayon > 40km'
        ELSE '⚠️ ATTENTION: ' || COUNT(*) || ' agents avec rayon > 40km'
    END as "Statut"
FROM users 
WHERE tolerance_radius_meters > 40000;

-- Afficher les rayons les plus élevés
SELECT 
    CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')) as "Agent",
    ROUND(tolerance_radius_meters / 1000.0, 1) as "Rayon (km)",
    tolerance_commune as "Commune",
    tolerance_source as "Zone"
FROM users 
WHERE tolerance_radius_meters IS NOT NULL
ORDER BY tolerance_radius_meters DESC
LIMIT 5;
