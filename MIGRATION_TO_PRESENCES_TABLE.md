# Migration vers la table presences

## Modifications apportées

### 1. Nouvel endpoint API `/api/presences`
Cet endpoint permet de récupérer les données depuis la table `presences` au lieu de calculer depuis `checkin_validations`.

**Utilisation :**
```javascript
GET /api/presences?from=2025-01-01T00:00:00Z&to=2025-01-31T23:59:59Z&user_id=123
```

**Paramètres :**
- `from` : Date de début (ISO format)
- `to` : Date de fin (ISO format)
- `user_id` : Filtre par agent (optionnel)

**Réponse :**
```json
{
  "success": true,
  "items": [
    {
      "id": 1,
      "user_id": 123,
      "start_time": "2025-01-15T08:00:00Z",
      "end_time": "2025-01-15T17:00:00Z",
      "location_lat": 6.4969,
      "location_lng": 2.6289,
      "within_tolerance": true,
      "distance_from_reference_m": 450,
      "tolerance_meters": 500,
      "status": "completed",
      "checkin_type": "validated",
      "users": {
        "id": 123,
        "name": "Jean Dupont",
        "project_name": "Projet Riz",
        ...
      }
    }
  ]
}
```

### 2. Fonction `updatePresenceSummary()` modifiée

**Avant :** La fonction utilisait l'endpoint `/reports/validations` qui retournait des données complexes à partir de `checkin_validations`.

**Après :** La fonction utilise maintenant directement l'endpoint `/api/presences` qui retourne des données simples et structurées.

**Changements principaux :**
- Utilisation de `user_id` au lieu de `agent_id`
- Utilisation de `start_time` au lieu de `date` ou `created_at`
- Utilisation de `within_tolerance` directement comme indicateur de présence
- Récupération des informations utilisateur via la relation `users`

### 3. Mapping des champs

| Table presences | Ancien (validations) | Description |
|----------------|---------------------|-------------|
| `user_id` | `agent_id` | ID de l'agent |
| `start_time` | `date` / `created_at` | Date et heure de début |
| `end_time` | `planned_end_time` | Date et heure de fin |
| `within_tolerance` | `valid` | Booléen indiquant si dans la zone |
| `distance_from_reference_m` | `distance_m` | Distance en mètres |
| `tolerance_meters` | `tolerance_m` | Tolérance en mètres |
| `location_lat` / `location_lng` | `lat` / `lon` (via checkins) | Coordonnées GPS |
| `status` | - | Statut (active/completed/cancelled) |
| `checkin_type` | `reason` | Type (validated/rejected) |

## Avantages de cette migration

1. **Performance** : La table `presences` contient déjà toutes les données nécessaires, pas besoin de faire des jointures complexes
2. **Simplicité** : Les données sont plus faciles à comprendre et manipuler
3. **Cohérence** : Une seule source de vérité pour les présences
4. **Extensibilité** : Plus facile d'ajouter de nouvelles informations (notes, photos, etc.)

## Fallback

Si l'endpoint `/api/presences` n'est pas disponible (serveur pas redémarré), la fonction fait automatiquement un fallback vers `/reports/validations` pour maintenir la compatibilité.

## Vérification

Pour vérifier que les données sont correctement affichées :

1. Ouvrir la page des rapports
2. Sélectionner un mois et une année
3. Le tableau "Récapitulatif mensuel des présences" devrait s'afficher avec les données de la table `presences`

## Prochaines étapes

1. Tester l'affichage du récapitulatif mensuel
2. Vérifier que tous les agents sont bien listés
3. Vérifier les comptes de jours présents/absents

