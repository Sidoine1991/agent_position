-- Script pour migrer les planifications existantes vers le nouveau format
-- ATTENTION: Exécuter seulement si vous avez des données existantes à migrer

-- 1. Vérifier s'il y a des planifications sans project_name
SELECT COUNT(*) as planifications_sans_projet 
FROM planifications 
WHERE project_name IS NULL;

-- 2. Mettre à jour les planifications sans project_name avec le project_name de l'utilisateur
UPDATE planifications 
SET project_name = u.project_name
FROM users u
WHERE planifications.user_id = u.id 
AND planifications.project_name IS NULL
AND u.project_name IS NOT NULL;

-- 3. Vérifier le résultat
SELECT 
    p.id,
    p.user_id,
    u.name as user_name,
    u.project_name as user_project,
    p.project_name as planification_project,
    p.date
FROM planifications p
JOIN users u ON p.user_id = u.id
WHERE p.project_name IS NULL
LIMIT 10;

-- 4. Créer des entrées dans weekly_planning_summary pour les planifications existantes
-- (Cette partie sera gérée automatiquement par le trigger)

-- 5. Vérifier les données migrées
SELECT 
    'Planifications totales' as type,
    COUNT(*) as count
FROM planifications
UNION ALL
SELECT 
    'Avec project_name' as type,
    COUNT(*) as count
FROM planifications
WHERE project_name IS NOT NULL
UNION ALL
SELECT 
    'Sans project_name' as type,
    COUNT(*) as count
FROM planifications
WHERE project_name IS NULL;
