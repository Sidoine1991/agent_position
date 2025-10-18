-- Script pour désactiver temporairement la vérification par email
-- Utilisez ce script si vous voulez permettre la création de comptes sans vérification email

-- Option 1: Marquer tous les utilisateurs existants comme vérifiés
UPDATE users 
SET is_verified = true 
WHERE is_verified = false;

-- Option 2: Supprimer les codes de vérification expirés
DELETE FROM verification_codes 
WHERE expires_at < NOW() OR used = true;

-- Option 3: Créer un utilisateur de test sans vérification
-- (Décommentez et modifiez selon vos besoins)
/*
INSERT INTO users (
    email, 
    password_hash, 
    name, 
    role, 
    is_verified,
    project_name
) VALUES (
    'test@example.com',
    'hashed_password_here',
    'Utilisateur Test',
    'agent',
    true,
    'Test Project'
);
*/

-- Vérifier les utilisateurs non vérifiés
SELECT 
    id, 
    email, 
    name, 
    role, 
    is_verified,
    created_at
FROM users 
WHERE is_verified = false
ORDER BY created_at DESC;

-- Message de confirmation
SELECT 'Vérification email désactivée temporairement. Les utilisateurs existants sont maintenant vérifiés.' as message;
