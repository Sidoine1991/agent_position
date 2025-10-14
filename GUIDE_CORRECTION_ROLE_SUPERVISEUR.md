# Guide : Correction du Rôle Superviseur dans la Base de Données

## Problème
La contrainte de base de données ne permet pas le rôle "superviseur", seulement "admin" et "agent". De plus, il y a des utilisateurs avec le rôle "supervisor" (en anglais) qui empêchent la modification de la contrainte.

## Solution
Il faut d'abord corriger les rôles existants, puis modifier la contrainte de la table `users` dans Supabase.

## Étapes à suivre

### 1. Correction des rôles existants (DÉJÀ FAIT)
Les rôles "supervisor" ont été temporairement changés en "admin" pour permettre la modification de la contrainte.

### 2. Accéder à l'interface Supabase
1. Aller sur [supabase.com](https://supabase.com)
2. Se connecter avec le compte administrateur
3. Sélectionner le projet "presence-ccrb"

### 3. Ouvrir l'éditeur SQL
1. Dans le menu de gauche, cliquer sur "SQL Editor"
2. Cliquer sur "New query"

### 4. Exécuter le script SQL
Copier et coller ce script dans l'éditeur :

```sql
-- Supprimer l'ancienne contrainte
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Ajouter la nouvelle contrainte avec le rôle superviseur
ALTER TABLE users ADD CONSTRAINT users_role_check 
CHECK (role IN ('admin', 'superviseur', 'agent'));
```

### 5. Exécuter le script
1. Cliquer sur le bouton "Run" (▶️)
2. Vérifier que les requêtes s'exécutent sans erreur

### 6. Finaliser la correction
Après avoir exécuté le script SQL, revenir au terminal et exécuter :

```bash
node finalize_supervisor_roles.js
```

Ce script va :
- Tester que la contrainte fonctionne
- Restaurer les rôles "superviseur" pour les utilisateurs concernés
- Vérifier que tout fonctionne correctement

## Vérification
Pour vérifier que tout fonctionne :

1. Le script `fix_supervisor_role.js` devrait afficher "✅ Contrainte corrigée avec succès!"
2. Le script `update_user_role.js` devrait afficher "Updated role for coutchikabernard26@gmail.com -> superviseur"

## Alternative : Interface Table Editor
Si l'éditeur SQL ne fonctionne pas :

1. Aller dans "Table Editor" > "users"
2. Cliquer sur l'onglet "Constraints"
3. Supprimer la contrainte `users_role_check`
4. Ajouter une nouvelle contrainte avec les valeurs : `admin`, `superviseur`, `agent`

## Fichiers créés
- `fix_supervisor_role.sql` - Script SQL à exécuter
- `fix_supervisor_role.js` - Script de test Node.js
- `GUIDE_CORRECTION_ROLE_SUPERVISEUR.md` - Ce guide

## Contact
Si vous avez besoin d'aide, contactez l'administrateur de la base de données ou l'équipe de développement.
