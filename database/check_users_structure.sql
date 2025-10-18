-- =====================================================
-- Script de diagnostic pour vérifier la structure de la table users
-- =====================================================

-- Vérifier le type de la colonne id dans la table users
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'id';

-- Vérifier les contraintes de clé primaire
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    tc.constraint_type
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'users' 
AND tc.constraint_type = 'PRIMARY KEY';

-- Vérifier les contraintes de clé étrangère existantes
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND ccu.table_name = 'users';

-- Vérifier si la table users existe et sa structure complète
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- Vérifier les extensions disponibles
SELECT * FROM pg_extension WHERE extname = 'uuid-ossp';

-- Vérifier si auth.uid() fonctionne et quel type il retourne
SELECT auth.uid() as auth_uid_type, pg_typeof(auth.uid()) as auth_uid_pg_type;