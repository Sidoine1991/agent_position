-- Script pour vérifier la structure de la table users
-- Exécuter ce script pour voir les colonnes disponibles

-- =====================================================
-- VÉRIFICATION DE LA STRUCTURE DE LA TABLE USERS
-- =====================================================

-- Afficher toutes les colonnes de la table users
SELECT 
    column_name as "Nom de la colonne",
    data_type as "Type de données",
    is_nullable as "Nullable",
    column_default as "Valeur par défaut",
    character_maximum_length as "Longueur max"
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position;

-- =====================================================
-- VÉRIFICATION DES CONTRAINTES
-- =====================================================

-- Afficher les contraintes de la table users
SELECT 
    tc.constraint_name as "Nom de la contrainte",
    tc.constraint_type as "Type",
    kcu.column_name as "Colonne"
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'users'
ORDER BY tc.constraint_type, kcu.column_name;

-- =====================================================
-- ÉCHANTILLON DES DONNÉES
-- =====================================================

-- Afficher un échantillon des données de la table users
SELECT 
    id,
    first_name,
    last_name,
    email,
    phone,
    status,
    created_at
FROM users 
ORDER BY id
LIMIT 10;

-- =====================================================
-- COMPTAGE DES UTILISATEURS
-- =====================================================

-- Compter le nombre total d'utilisateurs
SELECT COUNT(*) as "Nombre total d'utilisateurs" FROM users;

-- Compter par statut
SELECT 
    status as "Statut",
    COUNT(*) as "Nombre"
FROM users 
GROUP BY status
ORDER BY status;
