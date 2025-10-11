# Instructions pour appliquer les modifications

## Modifications apportées

### 1. Correction de la redirection "Se connecter"
- **Fichier modifié**: `web/index.html`
- **Problème résolu**: Le bouton "Se connecter" redirigeait vers `home.html` au lieu de permettre la connexion
- **Solution**: Amélioration de la logique de redirection pour diriger les utilisateurs connectés vers leur dashboard approprié

### 2. Masquage des champs spécifiques aux employés pour les administrateurs
- **Fichier modifié**: `web/register.html`
- **Problème résolu**: Les administrateurs devaient remplir des champs spécifiques aux employés
- **Solution**: 
  - Ajout de la classe CSS `employee-only-fields` aux champs concernés
  - JavaScript pour masquer/afficher ces champs selon le rôle sélectionné
  - Gestion dynamique des attributs `required`

### 3. Mise à jour de l'API Supabase
- **Fichier modifié**: `api/index-supabase.js`
- **Problème résolu**: L'API ne gérait pas tous les champs du formulaire d'inscription
- **Solution**: 
  - Ajout de tous les nouveaux champs dans la fonction d'inscription
  - Logique conditionnelle pour ne pas inclure les champs spécifiques aux employés pour les admins
  - Mise à jour de la réponse du profil utilisateur

### 4. Migration de base de données
- **Fichier créé**: `database/migration_add_user_fields.sql`
- **Problème résolu**: La table `users` ne contenait pas tous les champs nécessaires
- **Solution**: Migration SQL pour ajouter tous les nouveaux champs avec contraintes et index

## Champs spécifiques aux employés (masqués pour les administrateurs)

Les champs suivants sont maintenant masqués quand l'utilisateur sélectionne "Administrateur" :

1. **Latitude de référence** (`reference_lat`)
2. **Longitude de référence** (`reference_lon`) 
3. **Rayon de tolérance (m)** (`tolerance_radius_meters`)
4. **Jours attendus/mois** (`expected_days_per_month`)
5. **Heures attendues/mois** (`expected_hours_per_month`)
6. **Début contrat sur le projet** (`contract_start_date`)
7. **Fin contrat sur le projet** (`contract_end_date`)
8. **Nombre d'années d'ancienneté au CCR-B** (`years_of_service`)

## Instructions pour appliquer la migration

### Option 1: Via l'interface Supabase
1. Connectez-vous à votre projet Supabase
2. Allez dans l'onglet "SQL Editor"
3. Copiez le contenu du fichier `database/migration_add_user_fields.sql`
4. Exécutez la requête

### Option 2: Via la CLI Supabase
```bash
# Si vous avez la CLI Supabase installée
supabase db push
```

### Option 3: Via psql (si vous avez accès direct à la base)
```bash
psql -h your-host -U your-user -d your-database -f database/migration_add_user_fields.sql
```

## Vérification

Après avoir appliqué la migration, vérifiez que :

1. ✅ Le bouton "Se connecter" redirige correctement vers le dashboard approprié
2. ✅ Les champs spécifiques aux employés sont masqués pour les administrateurs
3. ✅ L'inscription fonctionne correctement pour tous les types d'utilisateurs
4. ✅ Les nouveaux champs sont bien sauvegardés en base de données

## Tests recommandés

1. **Test d'inscription administrateur** :
   - Sélectionner "Administrateur" comme rôle
   - Vérifier que les champs spécifiques aux employés sont masqués
   - Compléter l'inscription et vérifier en base

2. **Test d'inscription employé** :
   - Sélectionner "Agent" ou "Superviseur" comme rôle
   - Vérifier que tous les champs sont visibles
   - Compléter l'inscription avec tous les champs

3. **Test de connexion** :
   - Se connecter avec différents types de comptes
   - Vérifier la redirection vers le bon dashboard
