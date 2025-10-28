# Guide de synchronisation des validations vers la table presences

## Problème
Les résultats de validation de présence sont stockés dans `checkin_validations` mais ne sont pas stockés dans la table `presences`, ce qui fait qu'il manque des données pour certains agents.

## Solution implémentée

### 1. Modification automatique
Lorsqu'une validation est créée (début de mission via `/api/presence/start`), les données sont maintenant **automatiquement** insérées dans les deux tables :
- `checkin_validations` (comme avant)
- `presences` (nouveau - ajouté le 2025-01-XX)

### 2. Script de synchronisation pour données existantes

#### Option A : Via le script Node.js

```bash
# Synchroniser les données existantes
node scripts/sync_validations_to_presences.js
```

Ce script va :
1. Récupérer toutes les validations depuis `checkin_validations`
2. Récupérer les checkins associés pour les coordonnées et photos
3. Insérer dans `presences` uniquement les données qui n'existent pas déjà
4. Éviter les doublons en comparant `user_id` + `start_time`

#### Option B : Via l'API REST (Admin seulement)

```bash
# Appeler l'endpoint de synchronisation
curl -X POST http://localhost:3010/api/sync/presences \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

Réponse :
```json
{
  "success": true,
  "message": "Synchronisation terminée: 45 presences insérées",
  "count": 45
}
```

### 3. Ajout des colonnes manquantes à la table presences

Exécutez le script SQL suivant dans le SQL Editor de Supabase :

```sql
-- Ajouter les colonnes si elles n'existent pas déjà
ALTER TABLE presences 
  ADD COLUMN IF NOT EXISTS zone_id INTEGER,
  ADD COLUMN IF NOT EXISTS within_tolerance BOOLEAN,
  ADD COLUMN IF NOT EXISTS distance_from_reference_m INTEGER,
  ADD COLUMN IF NOT EXISTS tolerance_meters INTEGER;

-- Créer les index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_presences_zone_id ON presences(zone_id);
CREATE INDEX IF NOT EXISTS idx_presences_within_tolerance ON presences(within_tolerance);
```

Ou utilisez le fichier SQL fourni :

```bash
# Exécutez dans Supabase SQL Editor
# Le contenu de: scripts/add_presences_table_columns.sql
```

## Mapping des données

Les champs de `checkin_validations` sont mappés vers `presences` comme suit :

| checkin_validations | presences |
|---------------------|-----------|
| agent_id | user_id |
| reference_lat | location_lat (depuis checkins) |
| reference_lon | location_lng (depuis checkins) |
| planned_start_time | start_time |
| planned_end_time | end_time |
| valid | within_tolerance |
| distance_m | distance_from_reference_m |
| tolerance_m | tolerance_meters |
| checkins.note | notes |
| checkins.photo_path | photo_url |

## Vérification

### Vérifier le nombre de presences

```sql
-- Nombre total de presences
SELECT COUNT(*) FROM presences;

-- Nombre de presences par agent
SELECT user_id, COUNT(*) as count 
FROM presences 
GROUP BY user_id 
ORDER BY count DESC;

-- Comparer avec validations
SELECT 
  'Validations' as source, 
  COUNT(*) as count 
FROM checkin_validations
UNION ALL
SELECT 
  'Presences' as source, 
  COUNT(*) as count 
FROM presences;
```

### Vérifier les presences d'un agent spécifique

```sql
SELECT 
  p.id,
  p.user_id,
  p.start_time,
  p.end_time,
  p.within_tolerance,
  p.distance_from_reference_m,
  p.tolerance_meters,
  p.photo_url
FROM presences p
WHERE p.user_id = 123  -- Remplacez 123 par l'ID de l'agent
ORDER BY p.start_time DESC
LIMIT 10;
```

## Exécution des scripts

### 1. Ajouter les colonnes manquantes (si nécessaire)

```bash
# Connectez-vous à Supabase
# Ouvrez le SQL Editor
# Copiez-collez le contenu de scripts/add_presences_table_columns.sql
# Exécutez le script
```

### 2. Synchroniser les données existantes

```bash
# Option A : Via le script Node.js
node scripts/sync_validations_to_presences.js

# Option B : Via l'API
curl -X POST http://localhost:3010/api/sync/presences \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Fichiers modifiés/créés

1. **server.js** : Ajout de l'insertion dans `presences` lors de la création d'une validation
2. **scripts/sync_validations_to_presences.js** : Script de synchronisation des données existantes
3. **scripts/add_presences_table_columns.sql** : SQL pour ajouter les colonnes manquantes
4. **SYNC_PRESENCES_GUIDE.md** : Ce fichier d'instructions

## Notes importantes

- Les nouvelles validations seront automatiquement stockées dans les deux tables
- Le script de synchronisation évite les doublons en utilisant `user_id` + `start_time` comme clé
- L'insertion dans `presences` est non bloquante : si elle échoue, une validation reste créée dans `checkin_validations`
- La synchronisation peut être exécutée plusieurs fois sans créer de doublons

