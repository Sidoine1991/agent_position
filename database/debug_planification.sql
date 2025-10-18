
-- Script de débogage pour les problèmes de planification
-- Exécutez ce script dans le SQL Editor de Supabase

-- 1. Vérifier les utilisateurs et leur statut
SELECT 
    id, 
    email, 
    name, 
    role, 
    is_verified,
    created_at
FROM users 
ORDER BY id;

-- 2. Vérifier les planifications existantes
SELECT 
    id,
    user_id,
    date,
    planned_start_time,
    planned_end_time,
    description_activite,
    project_name,
    created_at
FROM planifications 
ORDER BY created_at DESC 
LIMIT 10;

-- 3. Vérifier les contraintes de la table planifications
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'planifications'
    AND tc.constraint_type = 'FOREIGN KEY';

-- 4. Vérifier les index sur la table planifications
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'planifications';

-- 5. Test d'insertion avec un utilisateur existant
-- Remplacez USER_ID par un ID valide de la table users
/*
INSERT INTO planifications (
    user_id, 
    date, 
    planned_start_time, 
    planned_end_time, 
    description_activite, 
    project_name
) VALUES (
    USER_ID,  -- Remplacez par un ID valide
    '2025-01-27',
    '08:00:00',
    '17:00:00',
    'Test de planification',
    'Test Project'
);
*/
