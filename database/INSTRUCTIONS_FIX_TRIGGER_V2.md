# Instructions pour corriger le problème de suppression d'utilisateur - Version 2

## Problème identifié
L'erreur se produit maintenant parce que le trigger essaie d'accéder à `OLD.project_id` mais la table `planifications` utilise `project_name` au lieu de `project_id`.

## Solution
Le trigger doit être modifié pour utiliser les bonnes colonnes de la table `planifications`.

## Instructions de correction

### 1. Connectez-vous à votre console Supabase
- Allez sur https://supabase.com/dashboard
- Sélectionnez votre projet
- Allez dans "SQL Editor"

### 2. Exécutez le script de correction
Copiez et exécutez le contenu du fichier `database/fix_trigger_correct_columns.sql` dans l'éditeur SQL.

### 3. Vérifiez que la correction fonctionne
Après avoir exécuté le script, essayez de supprimer un utilisateur pour vérifier que l'erreur ne se produit plus.

## Explication technique
Le problème était que le trigger utilisait des colonnes qui n'existent pas dans la table `planifications` :
- ❌ `project_id` (n'existe pas)
- ✅ `project_name` (existe)
- ✅ `agent_id` (existe)
- ✅ `user_id` (existe)

La version corrigée :
- Utilise `project_name` au lieu de `project_id`
- Gère correctement les opérations DELETE avec `OLD`
- Met à jour la structure de `weekly_planning_summary` si nécessaire
- Supprime les enregistrements orphelins

## Structure des tables

### Table `planifications`
```sql
- id (SERIAL PRIMARY KEY)
- user_id (INTEGER REFERENCES users(id))
- agent_id (INTEGER REFERENCES users(id))
- date (DATE NOT NULL)
- planned_start_time (TIME)
- planned_end_time (TIME)
- description_activite (TEXT)
- project_name (VARCHAR(255))
- resultat_journee (VARCHAR(20))
- observations (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### Table `weekly_planning_summary`
```sql
- id (SERIAL PRIMARY KEY)
- user_id (INTEGER REFERENCES users(id))
- week_start_date (DATE NOT NULL)
- week_end_date (DATE NOT NULL)
- total_planned_hours (DECIMAL(5,2))
- total_planned_days (INTEGER)
- activities_summary (TEXT)
- project_name (VARCHAR(255)) -- Utilise project_name, pas project_id
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

## Alternative rapide
Si vous voulez une solution temporaire, vous pouvez désactiver le trigger :
```sql
DROP TRIGGER IF EXISTS trigger_update_weekly_planning_summary ON planifications;
```
Mais cela désactivera la mise à jour automatique du récap hebdomadaire.
