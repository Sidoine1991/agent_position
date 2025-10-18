-- Script pour nettoyer les codes de vérification expirés et non utilisés
-- Exécutez ce script dans la console Supabase SQL Editor

-- 1. Vérifier les utilisateurs non vérifiés avec leurs codes
SELECT 
    id,
    email,
    name,
    is_verified,
    verification_code,
    verification_expires,
    created_at
FROM users 
WHERE is_verified = false
ORDER BY created_at DESC;

-- 2. Nettoyer les codes expirés (optionnel - décommentez si nécessaire)
-- UPDATE users 
-- SET verification_code = NULL, verification_expires = NULL
-- WHERE is_verified = false 
-- AND verification_expires < NOW();

-- 3. Marquer tous les utilisateurs existants comme vérifiés (solution temporaire)
-- ATTENTION: Cette commande désactive la vérification pour tous les utilisateurs existants
-- Décommentez seulement si vous voulez permettre l'accès sans vérification
/*
UPDATE users 
SET is_verified = true, verification_code = NULL, verification_expires = NULL
WHERE is_verified = false;
*/

-- 4. Vérifier le résultat
SELECT 
    COUNT(*) as total_users,
    COUNT(CASE WHEN is_verified = true THEN 1 END) as verified_users,
    COUNT(CASE WHEN is_verified = false THEN 1 END) as unverified_users
FROM users;

-- Message d'information
SELECT 'Script de nettoyage des codes de vérification exécuté. Vérifiez les résultats ci-dessus.' as message;
