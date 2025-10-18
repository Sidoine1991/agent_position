-- Script pour nettoyer et recréer les tables de planification
-- ATTENTION: Ce script supprime toutes les données existantes dans ces tables

-- 1. Supprimer les triggers et fonctions existants
DROP TRIGGER IF EXISTS trigger_update_weekly_planning_summary ON planifications;
DROP FUNCTION IF EXISTS update_weekly_planning_summary();

-- 2. Supprimer les tables dans l'ordre inverse des dépendances
DROP TABLE IF EXISTS weekly_planning_summary CASCADE;
DROP TABLE IF EXISTS planifications CASCADE;
DROP TABLE IF EXISTS user_projects CASCADE;
DROP TABLE IF EXISTS projects CASCADE;

-- 3. Recréer les tables (voir migration_simple_planning.sql)
-- Exécuter le contenu de migration_simple_planning.sql après ce script
