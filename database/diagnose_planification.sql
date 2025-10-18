
-- Script de correction pour les problèmes de planification
-- Exécutez ce script dans le SQL Editor de Supabase

-- 1. Vérifier la structure de la table planifications
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'planifications'
ORDER BY ordinal_position;

-- 2. Vérifier les contraintes de clé étrangère
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'planifications';

-- 3. Vérifier les utilisateurs existants
SELECT id, email, name, role FROM users ORDER BY id LIMIT 10;

-- 4. Vérifier les planifications existantes
SELECT * FROM planifications ORDER BY created_at DESC LIMIT 5;
