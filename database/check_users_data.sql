-- Script de vérification des données utilisateurs
-- Presence CCRB - Vérification de l'intégrité des données

-- 1. Vérification des tables existantes
SELECT 
    'Tables existantes' as check_type,
    COUNT(*) as count,
    'Info: Nombre total de tables' as description
FROM information_schema.tables 
WHERE table_schema = 'public';

-- 2. Liste des tables disponibles
SELECT 
    'Table disponible' as check_type,
    1 as count,
    CONCAT('Info: Table ', table_name, ' disponible') as description
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 3. Vérification des utilisateurs sans email valide
SELECT 
    'Utilisateurs sans email valide' as check_type,
    COUNT(*) as count,
    'Erreur: Email manquant ou invalide' as description
FROM users 
WHERE email IS NULL OR email = '' OR email NOT LIKE '%@%';

-- 4. Vérification des utilisateurs sans nom
SELECT 
    'Utilisateurs sans nom' as check_type,
    COUNT(*) as count,
    'Erreur: Nom manquant' as description
FROM users 
WHERE name IS NULL OR name = '';

-- 5. Vérification des rôles invalides
SELECT 
    'Utilisateurs avec rôle invalide' as check_type,
    COUNT(*) as count,
    'Erreur: Rôle non conforme' as description
FROM users 
WHERE role NOT IN ('admin', 'superviseur', 'agent');

-- 6. Vérification des emails dupliqués
SELECT 
    'Emails dupliqués' as check_type,
    COUNT(*) as count,
    'Erreur: Email déjà utilisé' as description
FROM (
    SELECT email, COUNT(*) 
    FROM users 
    GROUP BY email 
    HAVING COUNT(*) > 1
) duplicates;

-- 7. Vérification des utilisateurs non vérifiés
SELECT 
    'Utilisateurs non vérifiés' as check_type,
    COUNT(*) as count,
    'Info: Utilisateurs en attente de vérification' as description
FROM users 
WHERE is_verified = FALSE;

-- 8. Vérification des codes de vérification expirés
SELECT 
    'Codes de vérification expirés' as check_type,
    COUNT(*) as count,
    'Info: Codes expirés à nettoyer' as description
FROM verification_codes 
WHERE expires_at < CURRENT_TIMESTAMP;

-- 9. Statistiques générales des utilisateurs
SELECT 
    'Statistiques utilisateurs' as check_type,
    COUNT(*) as count,
    'Info: Total des utilisateurs' as description
FROM users;

-- 10. Répartition par rôle
SELECT 
    'Répartition par rôle' as check_type,
    COUNT(*) as count,
    CONCAT('Info: Utilisateurs avec rôle ', role) as description
FROM users 
GROUP BY role;

-- 11. Utilisateurs créés récemment (derniers 7 jours)
SELECT 
    'Utilisateurs récents' as check_type,
    COUNT(*) as count,
    'Info: Utilisateurs créés dans les 7 derniers jours' as description
FROM users 
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';

-- 12. Vérification des présences orphelines (si la table existe)
SELECT 
    'Présences orphelines' as check_type,
    COUNT(*) as count,
    'Erreur: Présences sans utilisateur valide' as description
FROM presences p
LEFT JOIN users u ON p.user_id = u.id
WHERE u.id IS NULL;

-- 13. Vérification des présences avec coordonnées invalides (si la table existe)
SELECT 
    'Présences avec coordonnées invalides' as check_type,
    COUNT(*) as count,
    'Erreur: Coordonnées GPS invalides' as description
FROM presences 
WHERE (location_lat IS NOT NULL AND (location_lat < -90 OR location_lat > 90))
   OR (location_lng IS NOT NULL AND (location_lng < -180 OR location_lng > 180));

-- 14. Vérification des présences avec dates incohérentes (si la table existe)
SELECT 
    'Présences avec dates incohérentes' as check_type,
    COUNT(*) as count,
    'Erreur: Date de fin antérieure à la date de début' as description
FROM presences 
WHERE end_time IS NOT NULL AND end_time < start_time;

-- 15. Vérification des présences actives (si la table existe)
SELECT 
    'Présences actives' as check_type,
    COUNT(*) as count,
    'Info: Présences en cours' as description
FROM presences 
WHERE status = 'active' AND end_time IS NULL;

-- 16. Vérification des présences complétées (si la table existe)
SELECT 
    'Présences complétées' as check_type,
    COUNT(*) as count,
    'Info: Présences terminées' as description
FROM presences 
WHERE status = 'completed' OR end_time IS NOT NULL;

-- 17. Vérification des utilisateurs avec présences (si la table existe)
SELECT 
    'Utilisateurs avec présences' as check_type,
    COUNT(DISTINCT u.id) as count,
    'Info: Utilisateurs ayant au moins une présence' as description
FROM users u
INNER JOIN presences p ON u.id = p.user_id;

-- 18. Vérification des utilisateurs sans présences (si la table existe)
SELECT 
    'Utilisateurs sans présences' as check_type,
    COUNT(*) as count,
    'Info: Utilisateurs n ayant jamais marqué de présence' as description
FROM users u
LEFT JOIN presences p ON u.id = p.user_id
WHERE p.id IS NULL;

-- 19. Vérification des missions orphelines (si la table existe)
SELECT 
    'Missions orphelines' as check_type,
    COUNT(*) as count,
    'Erreur: Missions sans utilisateur valide' as description
FROM missions m
LEFT JOIN users u ON m.user_id = u.id
WHERE u.id IS NULL;

-- 20. Vérification des missions avec dates incohérentes (si la table existe)
SELECT 
    'Missions avec dates incohérentes' as check_type,
    COUNT(*) as count,
    'Erreur: Date de fin antérieure à la date de début' as description
FROM missions 
WHERE end_date IS NOT NULL AND end_date < start_date;

-- 21. Vérification des check-ins orphelins (si la table existe)
SELECT 
    'Check-ins orphelins' as check_type,
    COUNT(*) as count,
    'Erreur: Check-ins sans utilisateur valide' as description
FROM checkins c
LEFT JOIN users u ON c.user_id = u.id
WHERE u.id IS NULL;

-- 22. Vérification des check-ins avec coordonnées invalides (si la table existe)
SELECT 
    'Check-ins avec coordonnées invalides' as check_type,
    COUNT(*) as count,
    'Erreur: Coordonnées GPS invalides' as description
FROM checkins 
WHERE (lat < -90 OR lat > 90) OR (lon < -180 OR lon > 180);

-- 23. Vérification des départements disponibles (si la table existe)
SELECT 
    'Départements disponibles' as check_type,
    COUNT(*) as count,
    'Info: Nombre de départements' as description
FROM departements;

-- 24. Vérification des communes disponibles (si la table existe)
SELECT 
    'Communes disponibles' as check_type,
    COUNT(*) as count,
    'Info: Nombre de communes' as description
FROM communes;

-- 25. Vérification des villages disponibles (si la table existe)
SELECT 
    'Villages disponibles' as check_type,
    COUNT(*) as count,
    'Info: Nombre de villages' as description
FROM villages;

-- 26. Vérification des présences par type (si la table existe)
SELECT 
    'Présences par type' as check_type,
    COUNT(*) as count,
    CONCAT('Info: Présences de type ', checkin_type) as description
FROM presences 
GROUP BY checkin_type;

-- 27. Vérification des check-ins par type (si la table existe)
SELECT 
    'Check-ins par type' as check_type,
    COUNT(*) as count,
    CONCAT('Info: Check-ins de type ', type) as description
FROM checkins 
GROUP BY type;

-- 28. Vérification des présences récentes (si la table existe)
SELECT 
    'Présences récentes' as check_type,
    COUNT(*) as count,
    'Info: Présences créées dans les 7 derniers jours' as description
FROM presences 
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';

-- 29. Vérification des check-ins récents (si la table existe)
SELECT 
    'Check-ins récents' as check_type,
    COUNT(*) as count,
    'Info: Check-ins créés dans les 7 derniers jours' as description
FROM checkins 
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';

-- 30. Vérification des utilisateurs avec informations complètes
SELECT 
    'Utilisateurs avec informations complètes' as check_type,
    COUNT(*) as count,
    'Info: Utilisateurs avec email, nom, téléphone et vérifiés' as description
FROM users 
WHERE email IS NOT NULL AND email != '' 
  AND name IS NOT NULL AND name != ''
  AND phone IS NOT NULL AND phone != ''
  AND is_verified = TRUE;