# Instructions pour corriger le problème de suppression d'utilisateur

## Problème identifié
L'erreur se produit lors de la suppression d'un utilisateur à cause du trigger `update_weekly_planning_summary()` qui essaie d'insérer des valeurs NULL dans la colonne `week_start_date` de la table `weekly_planning_summary`.

## Solution
Le trigger doit être modifié pour gérer correctement les opérations DELETE.

## Instructions de correction

### 1. Connectez-vous à votre console Supabase
- Allez sur https://supabase.com/dashboard
- Sélectionnez votre projet
- Allez dans "SQL Editor"

### 2. Exécutez le script de correction
Copiez et exécutez le contenu du fichier `database/fix_trigger_delete_user.sql` dans l'éditeur SQL.

### 3. Vérifiez que la correction fonctionne
Après avoir exécuté le script, essayez de supprimer un utilisateur pour vérifier que l'erreur ne se produit plus.

## Explication technique
Le problème était que le trigger original utilisait `NEW.date` même lors des opérations DELETE, mais `NEW` est NULL lors d'une suppression. La version corrigée :
- Utilise `OLD` pour les opérations DELETE
- Supprime directement les enregistrements de `weekly_planning_summary` lors d'une suppression
- Évite d'insérer des valeurs NULL

## Alternative rapide
Si vous voulez une solution temporaire, vous pouvez désactiver le trigger :
```sql
DROP TRIGGER IF EXISTS trigger_update_weekly_planning_summary ON planifications;
```
Mais cela désactivera la mise à jour automatique du récap hebdomadaire.
