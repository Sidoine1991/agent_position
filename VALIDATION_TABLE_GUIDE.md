# Guide de la Table de Validation de Présence

## 📋 Vue d'ensemble

Ce guide explique l'utilisation de la nouvelle table `presence_validations` qui centralise toutes les informations de validation de présence avec des détails complets.

## 🎯 Objectifs

1. **Synchroniser** `tolerance_meters` de la table `presences` avec `tolerance_radius_meters` de la table `users`
2. **Centraliser** toutes les validations de présence dans une table dédiée
3. **Améliorer** le suivi et l'audit des validations

## 🗄️ Structure de la Table

### Table `presence_validations`

```sql
CREATE TABLE presence_validations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    presence_id INTEGER REFERENCES presences(id),
    validation_status VARCHAR(20) NOT NULL, -- 'validated', 'rejected', 'pending'
    checkin_type VARCHAR(50) DEFAULT 'manual', -- 'manual', 'automatic', 'admin_override'
    checkin_lat DECIMAL(10, 8) NOT NULL,
    checkin_lng DECIMAL(11, 8) NOT NULL,
    checkin_location_name VARCHAR(255),
    reference_lat DECIMAL(10, 8),
    reference_lng DECIMAL(11, 8),
    distance_from_reference_m INTEGER,
    tolerance_meters INTEGER NOT NULL,
    within_tolerance BOOLEAN NOT NULL DEFAULT FALSE,
    validated_by INTEGER REFERENCES users(id),
    validation_reason TEXT,
    validation_notes TEXT,
    validation_method VARCHAR(50) DEFAULT 'gps',
    device_info JSONB,
    photo_url VARCHAR(500),
    checkin_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    validation_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## 🚀 Installation et Configuration

### Étape 1 : Créer la table de validation

```bash
# Exécuter le script SQL dans Supabase
psql -h your-supabase-host -U postgres -d postgres -f database/create_validation_table.sql
```

### Étape 2 : Synchroniser les colonnes de tolérance

```bash
# Synchroniser tolerance_meters avec tolerance_radius_meters
node scripts/sync_tolerance_meters.js
```

### Étape 3 : Migrer les données existantes

```bash
# Migrer vers la nouvelle table de validation
node scripts/migrate_to_validation_table.js
```

## 📊 Utilisation des APIs

### 1. Récupérer les validations

```javascript
// GET /api/presence-validations
const response = await fetch('/api/presence-validations?from=2025-01-01&to=2025-01-31&status=validated', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const validations = await response.json();
```

**Paramètres de requête :**
- `from` : Date de début (ISO string)
- `to` : Date de fin (ISO string)
- `user_id` : ID de l'utilisateur
- `status` : Statut de validation (`validated`, `rejected`, `pending`)
- `checkin_type` : Type de check-in (`manual`, `automatic`, `admin_override`)

### 2. Créer une validation

```javascript
// POST /api/presence-validations
const response = await fetch('/api/presence-validations', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    presence_id: 123,
    validation_status: 'validated',
    checkin_type: 'manual',
    checkin_lat: 9.6412,
    checkin_lng: 1.8995,
    checkin_location_name: 'Cotonou, Bénin',
    validation_reason: 'Présence validée par GPS',
    validation_notes: 'Agent dans la zone de tolérance',
    photo_url: 'https://example.com/photo.jpg',
    checkin_timestamp: '2025-01-23T08:30:00Z'
  })
});
```

## 🔄 Synchronisation des Colonnes de Tolérance

### Script de synchronisation

Le script `sync_tolerance_meters.js` :

1. **Récupère** tous les utilisateurs avec `tolerance_radius_meters`
2. **Identifie** les presences avec `tolerance_meters` différent
3. **Met à jour** `tolerance_meters` avec la valeur de `tolerance_radius_meters`
4. **Vérifie** la cohérence des données

### Exécution

```bash
# Synchronisation manuelle
node scripts/sync_tolerance_meters.js

# Ou via l'API (admin seulement)
curl -X POST http://localhost:3010/api/sync/tolerance-meters \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 📈 Migration des Données

### Script de migration

Le script `migrate_to_validation_table.js` :

1. **Récupère** toutes les presences existantes
2. **Calcule** les distances et validations
3. **Crée** les enregistrements dans `presence_validations`
4. **Préserve** les données existantes

### Données migrées

- ✅ Coordonnées de check-in
- ✅ Coordonnées de référence
- ✅ Calculs de distance
- ✅ Statuts de validation
- ✅ Photos et notes
- ✅ Timestamps

## 🎯 Avantages

### 1. **Centralisation**
- Toutes les validations dans une seule table
- Historique complet des validations
- Traçabilité des décisions

### 2. **Flexibilité**
- Support de différents types de validation
- Métadonnées enrichies
- Support des photos et notes

### 3. **Performance**
- Index optimisés pour les requêtes fréquentes
- Requêtes plus rapides
- Meilleure scalabilité

### 4. **Audit**
- Qui a validé quoi et quand
- Raisons de validation/rejet
- Informations sur l'appareil

## 🔍 Requêtes Utiles

### Validations par agent

```sql
SELECT 
  u.name,
  pv.validation_status,
  COUNT(*) as count
FROM presence_validations pv
JOIN users u ON pv.user_id = u.id
WHERE pv.checkin_timestamp >= '2025-01-01'
GROUP BY u.name, pv.validation_status
ORDER BY u.name, pv.validation_status;
```

### Statistiques de validation

```sql
SELECT 
  validation_status,
  checkin_type,
  COUNT(*) as count,
  AVG(distance_from_reference_m) as avg_distance,
  AVG(tolerance_meters) as avg_tolerance
FROM presence_validations
WHERE checkin_timestamp >= '2025-01-01'
GROUP BY validation_status, checkin_type
ORDER BY validation_status, checkin_type;
```

### Validations hors zone

```sql
SELECT 
  u.name,
  pv.checkin_location_name,
  pv.distance_from_reference_m,
  pv.tolerance_meters,
  pv.validation_reason
FROM presence_validations pv
JOIN users u ON pv.user_id = u.id
WHERE pv.within_tolerance = false
  AND pv.checkin_timestamp >= '2025-01-01'
ORDER BY pv.distance_from_reference_m DESC;
```

## 🛠️ Maintenance

### Vérification de cohérence

```bash
# Vérifier que tolerance_meters est synchronisé
node scripts/sync_tolerance_meters.js

# Vérifier les données migrées
node scripts/migrate_to_validation_table.js
```

### Nettoyage des données

```sql
-- Supprimer les validations orphelines
DELETE FROM presence_validations 
WHERE user_id NOT IN (SELECT id FROM users);

-- Nettoyer les validations anciennes (optionnel)
DELETE FROM presence_validations 
WHERE checkin_timestamp < '2024-01-01';
```

## 📞 Support

Pour toute question ou problème :

1. **Vérifiez** les logs du serveur
2. **Consultez** la documentation de l'API
3. **Testez** avec les scripts fournis
4. **Contactez** l'équipe de développement

## 🔄 Mise à jour du Code

Le code a été mis à jour pour :

1. ✅ **Utiliser** `checkin_type` pour déterminer le statut
2. ✅ **Synchroniser** les colonnes de tolérance
3. ✅ **Centraliser** les validations
4. ✅ **Améliorer** les logs et le debug

Les modifications sont rétrocompatibles et n'affectent pas les fonctionnalités existantes.
