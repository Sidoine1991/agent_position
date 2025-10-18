-- Script pour vérifier les contraintes de la table users
-- Exécuter ce script pour voir les contraintes qui empêchent les mises à jour

-- =====================================================
-- VÉRIFICATION DES CONTRAINTES DE LA TABLE USERS
-- =====================================================

-- Afficher toutes les contraintes de la table users
SELECT 
    tc.constraint_name as "Nom de la contrainte",
    tc.constraint_type as "Type",
    cc.check_clause as "Condition de vérification"
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc 
    ON tc.constraint_name = cc.constraint_name
WHERE tc.table_name = 'users'
ORDER BY tc.constraint_type, tc.constraint_name;

-- =====================================================
-- VÉRIFICATION SPÉCIFIQUE DE LA CONTRAINTE TOLERANCE
-- =====================================================

-- Chercher spécifiquement les contraintes liées à tolerance_radius
SELECT 
    constraint_name,
    check_clause
FROM information_schema.check_constraints 
WHERE check_clause LIKE '%tolerance%'
   OR constraint_name LIKE '%tolerance%';

-- =====================================================
-- VÉRIFICATION DES VALEURS ACTUELLES
-- =====================================================

-- Voir les valeurs actuelles de tolerance_radius_meters
SELECT 
    id,
    first_name,
    last_name,
    email,
    tolerance_radius_meters,
    custom_tolerance_applied,
    tolerance_source,
    tolerance_commune
FROM users 
WHERE tolerance_radius_meters IS NOT NULL
ORDER BY tolerance_radius_meters DESC;

-- =====================================================
-- TEST DES VALEURS PROBLÉMATIQUES
-- =====================================================

-- Tester les valeurs que nous voulons insérer
SELECT 
    'DJIBRIL ABDEL-HAFIZ' as agent,
    20000 as rayon_voulu,
    CASE 
        WHEN 20000 <= 10000 THEN 'OK (≤ 10km)'
        WHEN 20000 <= 15000 THEN 'OK (≤ 15km)'
        WHEN 20000 <= 20000 THEN 'OK (≤ 20km)'
        ELSE 'PROBLÈME (> 20km)'
    END as statut;

SELECT 
    'ADOHO D. THIBURCE' as agent,
    44000 as rayon_voulu,
    CASE 
        WHEN 44000 <= 10000 THEN 'OK (≤ 10km)'
        WHEN 44000 <= 15000 THEN 'OK (≤ 15km)'
        WHEN 44000 <= 20000 THEN 'OK (≤ 20km)'
        ELSE 'PROBLÈME (> 20km)'
    END as statut;
