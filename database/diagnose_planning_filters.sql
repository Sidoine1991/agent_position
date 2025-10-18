
-- Script de diagnostic et correction pour les filtres de planification
-- Exécutez ce script dans le SQL Editor de Supabase

-- 1. Vérifier les utilisateurs et leurs projets
SELECT 
    id,
    name,
    email,
    role,
    project_name,
    CASE 
        WHEN project_name IS NULL OR project_name = '' THEN '❌ Projet manquant'
        ELSE '✅ Projet défini'
    END as project_status
FROM users 
ORDER BY role, name;

-- 2. Vérifier les planifications et leurs projets
SELECT 
    id,
    user_id,
    date,
    project_name,
    description_activite,
    CASE 
        WHEN project_name IS NULL OR project_name = '' THEN '❌ Projet manquant'
        ELSE '✅ Projet défini'
    END as project_status
FROM planifications 
ORDER BY created_at DESC 
LIMIT 20;

-- 3. Compter les utilisateurs par rôle
SELECT 
    role,
    COUNT(*) as count,
    COUNT(CASE WHEN project_name IS NOT NULL AND project_name != '' THEN 1 END) as with_project,
    COUNT(CASE WHEN project_name IS NULL OR project_name = '' THEN 1 END) as without_project
FROM users 
GROUP BY role
ORDER BY role;

-- 4. Compter les planifications par projet
SELECT 
    project_name,
    COUNT(*) as count,
    COUNT(DISTINCT user_id) as unique_users
FROM planifications 
WHERE project_name IS NOT NULL AND project_name != ''
GROUP BY project_name
ORDER BY count DESC;

-- 5. Vérifier les agents sans projet
SELECT 
    id,
    name,
    email,
    project_name
FROM users 
WHERE role = 'agent' 
    AND (project_name IS NULL OR project_name = '')
ORDER BY name;

-- 6. Mettre à jour les agents sans projet (optionnel)
-- Décommentez et modifiez selon vos besoins
/*
UPDATE users 
SET project_name = 'Projet par défaut'
WHERE role = 'agent' 
    AND (project_name IS NULL OR project_name = '');
*/

-- 7. Vérifier les planifications sans projet
SELECT 
    id,
    user_id,
    date,
    project_name,
    description_activite
FROM planifications 
WHERE project_name IS NULL OR project_name = ''
ORDER BY created_at DESC;
