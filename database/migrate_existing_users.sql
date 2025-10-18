-- =====================================================
-- Script de migration pour les utilisateurs existants
-- Ajoute les données initiales pour les utilisateurs déjà présents
-- =====================================================

-- Vérifier que la table users existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        RAISE EXCEPTION 'La table users n''existe pas. Veuillez d''abord créer la table users.';
    END IF;
END $$;

-- =====================================================
-- 1. CRÉER DES OBJECTIFS PAR DÉFAUT POUR LES UTILISATEURS EXISTANTS
-- =====================================================

INSERT INTO personal_goals (user_id, title, description, goal_type, target_value, current_value, unit, deadline, status)
SELECT 
    u.id,
    'Présence parfaite',
    'Maintenir un taux de présence de 100%',
    'attendance',
    100,
    0,
    '%',
    (CURRENT_DATE + INTERVAL '30 days')::DATE,
    'active'
FROM users u
WHERE u.role = 'agent'
    AND NOT EXISTS (
        SELECT 1 FROM personal_goals pg 
        WHERE pg.user_id = u.id 
        AND pg.goal_type = 'attendance'
    );

INSERT INTO personal_goals (user_id, title, description, goal_type, target_value, current_value, unit, deadline, status)
SELECT 
    u.id,
    'Missions complétées',
    'Compléter 20 missions ce mois',
    'missions',
    20,
    0,
    'missions',
    (CURRENT_DATE + INTERVAL '30 days')::DATE,
    'active'
FROM users u
WHERE u.role = 'agent'
    AND NOT EXISTS (
        SELECT 1 FROM personal_goals pg 
        WHERE pg.user_id = u.id 
        AND pg.goal_type = 'missions'
    );

INSERT INTO personal_goals (user_id, title, description, goal_type, target_value, current_value, unit, deadline, status)
SELECT 
    u.id,
    'Temps sur le terrain',
    'Passer 150 heures sur le terrain ce mois',
    'field_time',
    150,
    0,
    'heures',
    (CURRENT_DATE + INTERVAL '30 days')::DATE,
    'active'
FROM users u
WHERE u.role = 'agent'
    AND NOT EXISTS (
        SELECT 1 FROM personal_goals pg 
        WHERE pg.user_id = u.id 
        AND pg.goal_type = 'field_time'
    );

-- =====================================================
-- 2. ATTRIBUER LE BADGE "DÉBUTANT" AUX UTILISATEURS EXISTANTS
-- =====================================================

INSERT INTO user_badges (user_id, badge_id, earned_at, progress)
SELECT 
    u.id,
    b.id,
    u.created_at, -- Utiliser la date de création du compte
    100
FROM users u
CROSS JOIN badges b
WHERE u.role = 'agent'
    AND b.name = 'Débutant'
    AND NOT EXISTS (
        SELECT 1 FROM user_badges ub 
        WHERE ub.user_id = u.id 
        AND ub.badge_id = b.id
    );

-- =====================================================
-- 3. CRÉER DES CONTACTS D'URGENCE PAR DÉFAUT
-- =====================================================

-- Trouver le superviseur principal pour chaque agent
WITH supervisor_contacts AS (
    SELECT 
        u.id as agent_id,
        s.id as supervisor_id,
        s.first_name,
        s.last_name,
        s.email,
        s.phone
    FROM users u
    JOIN users s ON s.role = 'supervisor' AND s.is_active = true
    WHERE u.role = 'agent' 
        AND u.is_active = true
        AND (u.supervisor_id = s.id OR u.supervisor_id IS NULL)
)
INSERT INTO emergency_contacts (user_id, name, phone, email, role, priority, is_active)
SELECT 
    sc.agent_id,
    COALESCE(sc.first_name || ' ' || sc.last_name, 'Superviseur Principal'),
    COALESCE(sc.phone, '+22912345678'),
    sc.email,
    'supervisor',
    1,
    true
FROM supervisor_contacts sc
WHERE NOT EXISTS (
    SELECT 1 FROM emergency_contacts ec 
    WHERE ec.user_id = sc.agent_id 
    AND ec.role = 'supervisor'
);

-- Ajouter un contact de sécurité par défaut
INSERT INTO emergency_contacts (user_id, name, phone, email, role, priority, is_active)
SELECT 
    u.id,
    'Sécurité CCRB',
    '+22987654321',
    'security@ccrb.bj',
    'security',
    2,
    true
FROM users u
WHERE u.role = 'agent' 
    AND u.is_active = true
    AND NOT EXISTS (
        SELECT 1 FROM emergency_contacts ec 
        WHERE ec.user_id = u.id 
        AND ec.role = 'security'
    );

-- =====================================================
-- 4. CRÉER DES CONVERSATIONS PAR DÉFAUT
-- =====================================================

-- Créer une conversation générale pour tous les agents
INSERT INTO conversations (name, type, created_by, is_active)
SELECT 
    'Conversation Générale',
    'group',
    (SELECT id FROM users WHERE role = 'admin' LIMIT 1),
    true
WHERE NOT EXISTS (
    SELECT 1 FROM conversations WHERE name = 'Conversation Générale'
);

-- Ajouter tous les agents à la conversation générale
INSERT INTO conversation_participants (conversation_id, user_id, joined_at, is_active)
SELECT 
    c.id,
    u.id,
    NOW(),
    true
FROM conversations c
CROSS JOIN users u
WHERE c.name = 'Conversation Générale'
    AND u.role IN ('agent', 'supervisor', 'admin')
    AND u.is_active = true
    AND NOT EXISTS (
        SELECT 1 FROM conversation_participants cp 
        WHERE cp.conversation_id = c.id 
        AND cp.user_id = u.id
    );

-- =====================================================
-- 5. CRÉER DES MÉTRIQUES DE PERFORMANCE INITIALES
-- =====================================================

-- Créer des métriques de base pour tous les agents
INSERT INTO performance_metrics (user_id, metric_type, metric_name, metric_value, period_start, period_end, period_type)
SELECT 
    u.id,
    'attendance',
    'taux_presence',
    0,
    DATE_TRUNC('month', CURRENT_DATE)::DATE,
    (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE,
    'monthly'
FROM users u
WHERE u.role = 'agent' 
    AND u.is_active = true
    AND NOT EXISTS (
        SELECT 1 FROM performance_metrics pm 
        WHERE pm.user_id = u.id 
        AND pm.metric_type = 'attendance'
        AND pm.period_type = 'monthly'
        AND pm.period_start = DATE_TRUNC('month', CURRENT_DATE)::DATE
    );

INSERT INTO performance_metrics (user_id, metric_type, metric_name, metric_value, period_start, period_end, period_type)
SELECT 
    u.id,
    'missions',
    'missions_completed',
    0,
    DATE_TRUNC('month', CURRENT_DATE)::DATE,
    (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE,
    'monthly'
FROM users u
WHERE u.role = 'agent' 
    AND u.is_active = true
    AND NOT EXISTS (
        SELECT 1 FROM performance_metrics pm 
        WHERE pm.user_id = u.id 
        AND pm.metric_type = 'missions'
        AND pm.period_type = 'monthly'
        AND pm.period_start = DATE_TRUNC('month', CURRENT_DATE)::DATE
    );

-- =====================================================
-- 6. CRÉER DES ENTRÉES DE CLASSEMENT INITIALES
-- =====================================================

-- Créer des entrées de classement pour le mois actuel
INSERT INTO leaderboard (user_id, period, period_start, period_end, score, missions_completed, field_time_hours, attendance_rate, efficiency_score)
SELECT 
    u.id,
    'monthly',
    DATE_TRUNC('month', CURRENT_DATE)::DATE,
    (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE,
    0,
    0,
    0,
    0,
    0
FROM users u
WHERE u.role = 'agent' 
    AND u.is_active = true
    AND NOT EXISTS (
        SELECT 1 FROM leaderboard l 
        WHERE l.user_id = u.id 
        AND l.period = 'monthly'
        AND l.period_start = DATE_TRUNC('month', CURRENT_DATE)::DATE
    );

-- =====================================================
-- 7. CRÉER DES RÉALISATIONS INITIALES
-- =====================================================

-- Créer une réalisation "Premier jour" pour tous les utilisateurs existants
INSERT INTO achievements (user_id, title, description, achievement_type, icon, earned_at)
SELECT 
    u.id,
    'Premier jour',
    'Première connexion à l''application',
    'milestone',
    '🎯',
    u.created_at
FROM users u
WHERE u.is_active = true
    AND NOT EXISTS (
        SELECT 1 FROM achievements a 
        WHERE a.user_id = u.id 
        AND a.title = 'Premier jour'
    );

-- =====================================================
-- 8. CRÉER DES ZONES GÉOGRAPHIQUES PAR DÉFAUT
-- =====================================================

-- Créer une zone de travail par défaut (Bénin - zone générale)
INSERT INTO geographic_zones (name, description, zone_type, coordinates, is_active, created_by)
SELECT 
    'Zone de Travail CCRB',
    'Zone de travail principale du CCRB au Bénin',
    'work',
    '{"type": "polygon", "coordinates": [[[1.0, 6.0], [3.0, 6.0], [3.0, 12.0], [1.0, 12.0], [1.0, 6.0]]]}'::jsonb,
    true,
    (SELECT id FROM users WHERE role = 'admin' LIMIT 1)
WHERE NOT EXISTS (
    SELECT 1 FROM geographic_zones WHERE name = 'Zone de Travail CCRB'
);

-- =====================================================
-- 9. CRÉER DES NOTIFICATIONS DE BIENVENUE
-- =====================================================

-- Créer une notification de bienvenue pour tous les utilisateurs
INSERT INTO notifications (user_id, title, body, notification_type, status, created_at)
SELECT 
    u.id,
    'Bienvenue dans CCRB!',
    'Bienvenue dans l''application CCRB! Découvrez toutes les nouvelles fonctionnalités disponibles.',
    'welcome',
    'sent',
    NOW()
FROM users u
WHERE u.is_active = true
    AND NOT EXISTS (
        SELECT 1 FROM notifications n 
        WHERE n.user_id = u.id 
        AND n.notification_type = 'welcome'
    );

-- =====================================================
-- 10. MISE À JOUR DES STATISTIQUES
-- =====================================================

-- Mettre à jour les statistiques de la base de données
ANALYZE;

-- =====================================================
-- RÉSUMÉ DE LA MIGRATION
-- =====================================================

DO $$
DECLARE
    users_count INTEGER;
    goals_count INTEGER;
    badges_count INTEGER;
    contacts_count INTEGER;
    conversations_count INTEGER;
    metrics_count INTEGER;
    leaderboard_count INTEGER;
    achievements_count INTEGER;
    zones_count INTEGER;
    notifications_count INTEGER;
BEGIN
    -- Compter les éléments créés
    SELECT COUNT(*) INTO users_count FROM users WHERE is_active = true;
    SELECT COUNT(*) INTO goals_count FROM personal_goals;
    SELECT COUNT(*) INTO badges_count FROM user_badges;
    SELECT COUNT(*) INTO contacts_count FROM emergency_contacts;
    SELECT COUNT(*) INTO conversations_count FROM conversations;
    SELECT COUNT(*) INTO metrics_count FROM performance_metrics;
    SELECT COUNT(*) INTO leaderboard_count FROM leaderboard;
    SELECT COUNT(*) INTO achievements_count FROM achievements;
    SELECT COUNT(*) INTO zones_count FROM geographic_zones;
    SELECT COUNT(*) INTO notifications_count FROM notifications;

    RAISE NOTICE '';
    RAISE NOTICE '🎉 ====================================================';
    RAISE NOTICE '✅ MIGRATION DES UTILISATEURS EXISTANTS TERMINÉE!';
    RAISE NOTICE '🎉 ====================================================';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Résumé de la migration:';
    RAISE NOTICE '   • % utilisateurs actifs traités', users_count;
    RAISE NOTICE '   • % objectifs personnels créés', goals_count;
    RAISE NOTICE '   • % badges attribués', badges_count;
    RAISE NOTICE '   • % contacts d''urgence créés', contacts_count;
    RAISE NOTICE '   • % conversations créées', conversations_count;
    RAISE NOTICE '   • % métriques de performance créées', metrics_count;
    RAISE NOTICE '   • % entrées de classement créées', leaderboard_count;
    RAISE NOTICE '   • % réalisations créées', achievements_count;
    RAISE NOTICE '   • % zones géographiques créées', zones_count;
    RAISE NOTICE '   • % notifications créées', notifications_count;
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Tous les utilisateurs existants sont maintenant prêts';
    RAISE NOTICE '   pour utiliser les systèmes avancés CCRB!';
    RAISE NOTICE '';
END $$;
