-- Script pour ajouter la colonne agent_id manquante dans la table planifications
-- Exécutez ce script dans le SQL Editor de Supabase

-- 1. Vérifier la structure actuelle
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'planifications'
ORDER BY ordinal_position;

-- 2. Ajouter la colonne agent_id si elle n'existe pas
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

-- 3. Créer un index sur agent_id pour les performances
CREATE INDEX IF NOT EXISTS idx_planifications_agent_id ON planifications(agent_id);

-- 4. Mettre à jour les enregistrements existants pour remplir agent_id
-- (Copier user_id vers agent_id pour les enregistrements existants)
UPDATE planifications 
SET agent_id = user_id 
WHERE agent_id IS NULL;

-- 5. Vérifier la structure finale
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'planifications'
ORDER BY ordinal_position;

-- 6. Vérifier les données mises à jour
SELECT 
    id,
    user_id,
    agent_id,
    date,
    description_activite,
    project_name
FROM planifications 
ORDER BY created_at DESC 
LIMIT 5;

-- 7. Test d'insertion avec agent_id
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
