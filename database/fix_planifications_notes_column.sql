
-- Script pour corriger la table planifications
-- Exécutez ce script dans le SQL Editor de Supabase

-- 1. Vérifier la structure actuelle
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'planifications'
ORDER BY ordinal_position;

-- 2. Ajouter la colonne notes si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='planifications' AND column_name='notes') THEN
        ALTER TABLE planifications ADD COLUMN notes TEXT;
        RAISE NOTICE 'Colonne notes ajoutée à la table planifications.';
    ELSE
        RAISE NOTICE 'Colonne notes existe déjà dans la table planifications.';
    END IF;
END $$;

-- 3. Vérifier la structure finale
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'planifications'
ORDER BY ordinal_position;
