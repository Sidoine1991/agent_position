# Guide de Mise à jour Supabase - Rayons de Tolérance

## 📋 Vue d'ensemble

Ce guide explique comment mettre à jour la table `users` dans Supabase avec les rayons de tolérance personnalisés calculés pour chaque agent.

## 🎯 Objectif

Appliquer les rayons de tolérance personnalisés dans la base de données :
- **Zone PDA4 (Nord)** : 11 agents avec rayons de 8km à 44km
- **Zone SUD** : 4 agents avec rayons de 28km
- **Agents sans déclaration** : Rayon par défaut de 6km

## 🛠️ Méthodes d'exécution

### ⚠️ IMPORTANT: Résolution des erreurs

#### Erreur 1: "column does not exist"
Si vous obtenez l'erreur `ERROR: 42703: column "custom_tolerance_applied" of relation "users" does not exist` :

#### Erreur 2: "check constraint violation"
Si vous obtenez l'erreur `ERROR: 23514: new row for relation "users" violates check constraint "check_tolerance_radius"` :

**Cas spécifique : ADOHO D. THIBURCE (44km)**
- **Problème** : La contrainte limite les rayons à 20km maximum
- **Solution** : Le script `fix_tolerance_constraint.sql` supprime cette limite et autorise jusqu'à 100km

### Procédure complète (4 étapes)

### Étape 1 : Vérifier la structure de la table

1. **Accéder à Supabase Dashboard** → SQL Editor
2. **Exécuter** :
   ```sql
   -- Copier le contenu de database/check_users_structure.sql
   ```

### Étape 2 : Ajouter les colonnes manquantes

1. **Exécuter le script d'ajout de colonnes** :
   ```sql
   -- Copier le contenu de database/add_tolerance_columns.sql
   ```

### Étape 3 : Corriger les contraintes (NOUVEAU)

1. **Vérifier les contraintes** :
   ```sql
   -- Copier le contenu de database/check_constraints.sql
   ```

2. **Corriger les contraintes** :
   ```sql
   -- Copier le contenu de database/fix_tolerance_constraint.sql
   ```

3. **Tester les valeurs** (optionnel) :
   ```sql
   -- Copier le contenu de database/test_tolerance_values.sql
   ```

4. **Validation finale** (recommandé) :
   ```sql
   -- Copier le contenu de database/final_validation.sql
   ```

### Étape 4 : Mettre à jour les rayons

1. **Exécuter le script de mise à jour final** :
   ```sql
   -- Copier le contenu de database/update_agent_tolerance_radius_final.sql
   ```

### Méthode 1 : Interface Web (Recommandée)

1. **Accéder à l'interface** :
   ```
   http://localhost:3010/supabase-tolerance-update.html
   ```

2. **Suivre les instructions** affichées dans l'interface

### Méthode 2 : Script SQL Direct

1. **Accéder à Supabase Dashboard** :
   - Aller sur [supabase.com](https://supabase.com)
   - Ouvrir votre projet
   - Aller dans "SQL Editor"

2. **Exécuter les scripts dans l'ordre** :
   - `database/check_users_structure.sql`
   - `database/add_tolerance_columns.sql`
   - `database/update_agent_tolerance_radius_fixed.sql`

### Méthode 3 : Console JavaScript

1. **Ouvrir la console** dans votre navigateur
2. **Charger le script** :
   ```javascript
   // Charger le script de mise à jour
   const script = document.createElement('script');
   script.src = '/update-tolerance-supabase.js';
   document.head.appendChild(script);
   
   // Exécuter les mises à jour
   executeAllToleranceUpdates();
   ```

## 📊 Détails des Mises à jour

### Zone PDA4 (Nord) - 11 Agents

| Agent | Commune | Rayon (km) | Rayon (m) |
|-------|---------|------------|-----------|
| DJIBRIL ABDEL-HAFIZ | DJOUGOU | 20 | 20000 |
| GOUKALODE CALIXTE | DASSA-ZOUMÉ | 17.6 | 17600 |
| EKPA Chabi Ogoudélé Aimé | BASSILA | 16 | 16000 |
| KALOA Moukimiou | OUAKÉ | 20 | 20000 |
| CHERIF FABADE DEKANDE LUC | SAVALOU | 24 | 24000 |
| FADO kami Macaire | BANTÈ | 12 | 12000 |
| TCHETAN PRUDENCE | GLAZOUE | 8 | 8000 |
| AKPO ANOS | DASSA ZOUMÈ | 16.8 | 16800 |
| DAGAN Bruno | Glazoué | 20 | 20000 |
| ADOHO D. THIBURCE | SAVALOU | 44 | 44000 |
| SERIKI FATAI | BANTÉ | 17.6 | 17600 |

### Zone SUD - 4 Agents

| Agent | Commune | Rayon (km) | Rayon (m) |
|-------|---------|------------|-----------|
| DAGNITO Mariano | Zogbodomey | 28 | 28000 |
| GOGAN Ida | Zogbodomey | 28 | 28000 |
| ADJOVI Sabeck | Zogbodomey | 28 | 28000 |
| TOGNON TCHEGNONSI Bernice | Zogbodomey | 28 | 28000 |

### Agents sans déclaration

- **Rayon par défaut** : 6 km (6000 m)
- **Source** : 'default'
- **Appliqué à** : Tous les autres agents

## 🔍 Vérification des Mises à jour

### Requête de vérification

```sql
-- Vérifier les mises à jour par zone
SELECT 
    tolerance_source as "Zone",
    COUNT(*) as "Nombre d'agents",
    AVG(tolerance_radius_meters) as "Rayon moyen (m)",
    MIN(tolerance_radius_meters) as "Rayon minimum (m)",
    MAX(tolerance_radius_meters) as "Rayon maximum (m)"
FROM users 
WHERE tolerance_radius_meters IS NOT NULL
GROUP BY tolerance_source
ORDER BY tolerance_source;
```

### Requête de détail

```sql
-- Voir les détails par agent
SELECT 
    CONCAT(first_name, ' ', last_name) as "Nom complet",
    email as "Email",
    tolerance_commune as "Commune",
    tolerance_source as "Zone",
    tolerance_radius_meters as "Rayon (m)",
    ROUND(tolerance_radius_meters / 1000.0, 1) as "Rayon (km)",
    custom_tolerance_applied as "Personnalisé"
FROM users 
WHERE tolerance_radius_meters IS NOT NULL
ORDER BY tolerance_source, tolerance_commune, last_name;
```

## ⚠️ Précautions

### Avant l'exécution

1. **Sauvegarde** : Créer une sauvegarde de la table `users`
2. **Test** : Tester sur un environnement de développement
3. **Vérification** : Vérifier que les noms d'agents correspondent

### Pendant l'exécution

1. **Surveillance** : Surveiller les logs d'exécution
2. **Vérification** : Vérifier le nombre de lignes affectées
3. **Arrêt** : Pouvoir arrêter en cas de problème

### Après l'exécution

1. **Validation** : Exécuter les requêtes de vérification
2. **Test** : Tester la fonctionnalité GPS
3. **Documentation** : Documenter les changements

## 🚨 Résolution de problèmes

### Problème : Aucun agent trouvé

**Cause** : Les noms dans la base ne correspondent pas exactement
**Solution** : 
1. Vérifier les noms dans la table `users`
2. Ajuster les conditions WHERE dans le script SQL
3. Utiliser des correspondances plus flexibles

### Problème : Erreur de permissions

**Cause** : Droits insuffisants sur la table `users`
**Solution** :
1. Vérifier les permissions RLS (Row Level Security)
2. Exécuter en tant qu'administrateur
3. Utiliser un service role

### Problème : Mise à jour partielle

**Cause** : Certains agents n'ont pas été trouvés
**Solution** :
1. Vérifier les logs d'exécution
2. Exécuter les mises à jour manquantes individuellement
3. Ajuster les critères de recherche

## 📁 Fichiers créés

### Scripts SQL
- `database/check_users_structure.sql` - Vérification de la structure
- `database/add_tolerance_columns.sql` - Ajout des colonnes manquantes
- `database/check_constraints.sql` - Vérification des contraintes
- `database/fix_tolerance_constraint.sql` - Correction des contraintes
- `database/test_tolerance_values.sql` - Test des valeurs
- `database/final_validation.sql` - Validation finale
- `database/update_agent_tolerance_radius_final.sql` - Mise à jour finale

### Interface et Documentation
- `www/update-tolerance-supabase.js` - Script JavaScript d'exécution
- `www/supabase-tolerance-update.html` - Interface web d'administration
- `www/TOLERANCE_BUSINESS_LOGIC.md` - Analyse de la logique métier
- `www/SUPABASE_UPDATE_GUIDE.md` - Ce guide

## 🎉 Résultat attendu

Après l'exécution réussie :

- ✅ 15 agents avec rayons personnalisés
- ✅ Autres agents avec rayon par défaut (6km)
- ✅ Colonnes `tolerance_radius_meters`, `custom_tolerance_applied`, `tolerance_source`, `tolerance_commune` mises à jour
- ✅ Système GPS utilisant les rayons personnalisés

---

*Guide créé le : ${new Date().toLocaleDateString('fr-FR')}*
*Version : 1.0*
