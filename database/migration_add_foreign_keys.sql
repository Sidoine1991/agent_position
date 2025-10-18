-- Migration pour ajouter les contraintes de clés étrangères après création des tables
-- Cette migration doit être exécutée après migration_planning_improvements.sql

-- Ajouter les contraintes de clés étrangères pour project_id
ALTER TABLE planifications 
ADD CONSTRAINT fk_planifications_project_id 
FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

ALTER TABLE weekly_planning_summary 
ADD CONSTRAINT fk_weekly_planning_summary_project_id 
FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

-- Ajouter les contraintes de clés étrangères pour user_projects
ALTER TABLE user_projects 
ADD CONSTRAINT fk_user_projects_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE user_projects 
ADD CONSTRAINT fk_user_projects_project_id 
FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
