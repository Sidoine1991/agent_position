-- Script pour corriger la contrainte de la table planifications
-- Exécutez ce script dans le SQL Editor de Supabase

-- 1. Vérifier la structure de la table
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'planifications' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Vérifier les contraintes existantes
SELECT 
    constraint_name, 
    constraint_type
FROM information_schema.table_constraints 
WHERE table_name = 'planifications' 
    AND table_schema = 'public';

-- 3. Vérifier les index existants
SELECT 
    indexname, 
    indexdef
FROM pg_indexes 
WHERE tablename = 'planifications' 
    AND schemaname = 'public';

-- 4. Vérifier s'il y a des doublons (agent_id, date)
SELECT 
    agent_id, 
    date, 
    COUNT(*) as count
FROM planifications 
GROUP BY agent_id, date 
HAVING COUNT(*) > 1;

-- 5. Supprimer les doublons si nécessaire (garder le plus récent)
WITH duplicates AS (
    SELECT 
        id,
        ROW_NUMBER() OVER (PARTITION BY agent_id, date ORDER BY updated_at DESC) as rn
    FROM planifications
)
DELETE FROM planifications 
WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
);

-- 6. Créer la contrainte unique sur (agent_id, date)
-- Cette contrainte permettra l'upsert avec onConflict
ALTER TABLE planifications 
ADD CONSTRAINT planifications_agent_date_unique 
UNIQUE (agent_id, date);

-- 7. Vérifier que la contrainte a été créée
SELECT 
    constraint_name, 
    constraint_type
FROM information_schema.table_constraints 
WHERE table_name = 'planifications' 
    AND table_schema = 'public'
    AND constraint_name = 'planifications_agent_date_unique';

-- 8. Test d'insertion pour vérifier que tout fonctionne
-- Remplacez USER_ID par un ID valide de la table users
/*
INSERT INTO planifications (
    user_id,
    agent_id,
    date,
    planned_start_time,
    planned_end_time,
    description_activite,
    project_name,
    updated_at
) VALUES (
    (SELECT id FROM users LIMIT 1),
    (SELECT id FROM users LIMIT 1),
    '2025-01-28',
    '08:00:00',
    '17:00:00',
    'Test de contrainte unique',
    'Test Project',
    NOW()
) ON CONFLICT (agent_id, date) 
DO UPDATE SET
    planned_start_time = EXCLUDED.planned_start_time,
    planned_end_time = EXCLUDED.planned_end_time,
    description_activite = EXCLUDED.description_activite,
    project_name = EXCLUDED.project_name,
    updated_at = EXCLUDED.updated_at;
*/
