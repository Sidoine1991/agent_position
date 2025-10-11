# Guide de dépannage - Planification Presence CCRB

## Erreurs courantes et solutions

### ❌ Erreur: `column "user_id" does not exist`
**Cause**: La table `planifications` n'existe pas encore, mais le script essaie de créer des index dessus.

**Solution**:
```sql
-- Exécuter dans l'ordre :
1. database/check_existing_tables.sql (pour vérifier l'état)
2. database/migration_simple_planning.sql (pour créer toutes les tables)
```

### ❌ Erreur: `relation "weekly_planning_summary" does not exist`
**Cause**: La table `weekly_planning_summary` n'a pas été créée.

**Solution**:
```sql
-- Exécuter :
database/migration_simple_planning.sql
```

### ❌ Erreur: `relation "projects" does not exist`
**Cause**: La table `projects` n'existe pas.

**Solution**:
```sql
-- Exécuter :
database/migration_simple_planning.sql
```

### ❌ Erreur de contraintes de clés étrangères
**Cause**: Tentative de créer des contraintes sur des tables qui n'existent pas.

**Solution**:
```sql
-- Nettoyer d'abord :
database/clean_and_recreate_planning.sql

-- Puis recréer :
database/migration_simple_planning.sql
```

## Procédure de récupération complète

Si vous avez des problèmes persistants, suivez cette procédure :

### Étape 1: Vérifier l'état actuel
```sql
-- Exécuter ce script pour voir quelles tables existent :
database/check_existing_tables.sql
```

### Étape 2: Nettoyer (si nécessaire)
```sql
-- ATTENTION: Supprime toutes les données de planification
database/clean_and_recreate_planning.sql
```

### Étape 3: Créer les tables
```sql
-- Créer toutes les tables de planification :
database/migration_simple_planning.sql
```

### Étape 4: Vérifier l'installation
```sql
-- Tester que tout fonctionne :
database/test_planning_tables.sql
```

### Étape 5: Redémarrer l'application
- Redémarrer le serveur pour prendre en compte les modifications de l'API

## Vérifications post-installation

### 1. Tables créées
Vérifiez que ces tables existent :
- ✅ `projects`
- ✅ `user_projects` 
- ✅ `planifications`
- ✅ `weekly_planning_summary`

### 2. Projets par défaut
Vérifiez que ces projets existent :
- ✅ "Projet Général"
- ✅ "Formation Agricole"
- ✅ "Suivi Terrain"

### 3. Utilisateurs assignés
Vérifiez que tous les utilisateurs sont assignés au "Projet Général"

### 4. API fonctionnelle
Testez ces endpoints :
- ✅ `GET /api/projects`
- ✅ `GET /api/planifications`
- ✅ `GET /api/planifications/weekly-summary`

## Support

Si vous rencontrez encore des problèmes :

1. **Vérifiez les logs** de l'application pour des erreurs spécifiques
2. **Exécutez** `database/test_planning_tables.sql` pour un diagnostic complet
3. **Vérifiez** que la table `users` existe et contient des données
4. **Assurez-vous** que vous avez les permissions nécessaires sur la base de données
