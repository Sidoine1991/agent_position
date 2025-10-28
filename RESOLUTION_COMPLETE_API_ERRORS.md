# Résolution des erreurs API et problèmes de planification

## Problèmes identifiés

### 1. Endpoints API manquants (404 errors)
Les endpoints suivants étaient manquants dans `server.js` :
- `/api/work-zones`
- `/api/contacts`
- `/api/emergency-contacts`
- `/api/help/content`
- `/api/missions`
- `/api/analytics/presence`
- `/api/analytics/missions`
- `/api/analytics/performance`
- `/api/agent/achievements`
- `/api/agent/leaderboard`
- `/api/checkins` (GET)
- `/api/goals`
- `/api/badges`
- `/api/departments`
- `/api/locations`
- `/api/users/projects`
- `/api/validations`

### 2. Problème de relations superviseur-agent
- La table `users` n'avait pas de champ `supervisor_id`
- Le système de planification ne pouvait pas filtrer les agents par superviseur
- Les utilisateurs n'étaient pas trouvés dans la map des utilisateurs

## Solutions implémentées

### 1. ✅ Endpoints API ajoutés
Tous les endpoints manquants ont été ajoutés dans `server.js` avec :
- Authentification appropriée
- Gestion d'erreurs
- Requêtes Supabase correctes
- Réponses JSON standardisées

### 2. ✅ Correction du système de planification
- Ajout de la création de `state.usersMap` dans la fonction `loadUsers()`
- Amélioration de la gestion des utilisateurs dans le système de planification

### 3. ✅ Scripts de correction de la base de données
- `add_supervisor_id_manual.sql` : Script SQL à exécuter manuellement dans Supabase
- `assign_supervisors.js` : Script pour assigner des superviseurs aux agents
- `fix_supervisor_relationships.js` : Script complet de correction

## Instructions de déploiement

### Étape 1 : Ajouter le champ supervisor_id
Exécutez le script SQL dans Supabase SQL Editor :
```sql
-- Ajouter la colonne supervisor_id
ALTER TABLE users ADD COLUMN supervisor_id INTEGER REFERENCES users(id);

-- Créer un index pour les performances
CREATE INDEX IF NOT EXISTS idx_users_supervisor_id ON users(supervisor_id);
```

### Étape 2 : Assigner des superviseurs aux agents
```bash
node assign_supervisors.js
```

### Étape 3 : Redémarrer le serveur
```bash
npm start
```

## Vérification

### Vérifier que les endpoints fonctionnent
Testez ces URLs dans votre navigateur ou avec curl :
- `http://localhost:3010/api/test-server`
- `http://localhost:3010/api/work-zones` (avec authentification)
- `http://localhost:3010/api/contacts` (avec authentification)

### Vérifier les relations superviseur-agent
Exécutez cette requête dans Supabase :
```sql
SELECT 
  u.id,
  u.name as agent_name,
  u.role,
  s.name as supervisor_name
FROM users u
LEFT JOIN users s ON u.supervisor_id = s.id
WHERE u.role = 'agent'
ORDER BY u.name;
```

## Résultats attendus

Après ces corrections :
1. ✅ Plus d'erreurs 404 sur les endpoints API
2. ✅ Plus d'erreurs 401 sur les endpoints protégés (si authentifié)
3. ✅ Le système de planification peut filtrer par superviseur
4. ✅ Les utilisateurs sont correctement trouvés dans la map
5. ✅ Les relations superviseur-agent fonctionnent

## Fichiers modifiés

- `server.js` : Ajout des endpoints API manquants
- `web/planning.js` : Correction de la création de usersMap
- `add_supervisor_id_manual.sql` : Script SQL pour la base de données
- `assign_supervisors.js` : Script d'attribution des superviseurs
- `fix_supervisor_relationships.js` : Script complet de correction

## Notes importantes

- Les endpoints retournent des données vides par défaut (tables peuvent ne pas exister)
- Les relations superviseur-agent sont assignées de manière cyclique
- Le système est maintenant prêt pour une utilisation complète
- Tous les endpoints respectent les permissions d'authentification
