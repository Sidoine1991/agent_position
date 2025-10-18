
-- Script de correction pour le problème agent_id dans planifications
-- Exécutez ce script dans le SQL Editor de Supabase

-- 1. Vérifier la structure actuelle de la table planifications
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'planifications'
ORDER BY ordinal_position;

-- 2. Vérifier les contraintes de clé étrangère
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

-- 3. Ajouter la colonne agent_id si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'planifications' 
        AND column_name = 'agent_id'
    ) THEN
        ALTER TABLE planifications ADD COLUMN agent_id INTEGER REFERENCES users(id);
        RAISE NOTICE 'Colonne agent_id ajoutée avec succès';
    ELSE
        RAISE NOTICE 'Colonne agent_id existe déjà';
    END IF;
END $$;

-- 4. Créer un index sur agent_id pour les performances
CREATE INDEX IF NOT EXISTS idx_planifications_agent_id ON planifications(agent_id);

-- 5. Vérifier la structure finale
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'planifications'
ORDER BY ordinal_position;

-- 6. Test d'insertion avec agent_id
-- Remplacez USER_ID par un ID valide de la table users
/*
INSERT INTO planifications (
    user_id,
    agent_id,
    date,
    planned_start_time,
    planned_end_time,
    description_activite,
    project_name
) VALUES (
    USER_ID,  -- Remplacez par un ID valide
    USER_ID,  -- Même ID pour agent_id
    '2025-01-27',
    '08:00:00',
    '17:00:00',
    'Test avec agent_id',
    'Test Project'
);
*/
