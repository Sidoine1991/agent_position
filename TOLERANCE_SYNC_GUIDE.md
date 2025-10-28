# Guide de Synchronisation des Valeurs de Tolérance

## Problème Résolu

Le problème était que les valeurs dans la colonne `tolerance_meters` de la table `presence_validations` ne correspondaient pas aux valeurs de `tolerance_radius_meters` de la table `users` pour chaque agent.

**Avant la correction :**
- Toutes les validations avaient `tolerance_meters = 100m`
- Les utilisateurs avaient des valeurs différentes (ex: 10000m, 220000m, etc.)

**Après la correction :**
- Les validations utilisent maintenant les bonnes valeurs de tolérance de chaque utilisateur
- 266 validations ont été mises à jour avec succès

## Scripts de Maintenance

### 1. Vérification des Données
```bash
node scripts/check_tolerance_data.js
```
- Vérifie la cohérence entre `users.tolerance_radius_meters` et `presence_validations.tolerance_meters`
- Affiche un rapport détaillé des incohérences

### 2. Synchronisation Complète
```bash
node scripts/sync_tolerance_validations.js
```
- Synchronise toutes les valeurs de `tolerance_meters` dans `presence_validations`
- Utilise les valeurs de `tolerance_radius_meters` de la table `users`
- Met à jour en batch pour optimiser les performances

### 3. Maintenance Continue
```bash
node scripts/maintain_tolerance_sync.js
```
- Vérifie et corrige les validations récentes (dernières 24h)
- Effectue une vérification de cohérence globale
- Idéal pour une exécution périodique (cron job)

## Logique de Synchronisation

### Backend (server.js)
L'endpoint `POST /api/presence-validations` utilise automatiquement :
```javascript
tolerance_meters: user.tolerance_radius_meters || 500
```

### Frontend (reports-backend.js)
La fonction `storePresenceValidations` utilise la priorité :
```javascript
tolerance_meters: presence.tolerance_meters || presence.users?.tolerance_radius_meters || 500
```

## Vérification de l'État Actuel

✅ **Toutes les validations existantes sont maintenant synchronisées**
✅ **Les nouvelles validations utilisent automatiquement les bonnes valeurs**
✅ **La cohérence est maintenue entre les tables**

## Recommandations

1. **Exécution périodique** : Lancez `maintain_tolerance_sync.js` quotidiennement
2. **Surveillance** : Vérifiez régulièrement avec `check_tolerance_data.js`
3. **Modifications utilisateur** : Si vous modifiez `tolerance_radius_meters` d'un utilisateur, relancez la synchronisation

## Exemple de Résultat

```
👥 Utilisateurs avec tolerance_radius_meters:
  ID 113: COUTCHIKA AKPO BERNARD - 220000m
  ID 137: Koutchika Emilie - 16000m
  ID 118: HOUESSOU BRIGITTE - 10000m

📊 Validations avec tolerance_meters:
  ✅ Validation 8 - User 113: 220000m (devrait être 220000m)
  ✅ Validation 9 - User 137: 16000m (devrait être 16000m)
  ✅ Validation 11 - User 118: 10000m (devrait être 10000m)

📈 Résumé: 0/10 validations ont des valeurs de tolérance incorrectes
```

Le système est maintenant entièrement synchronisé et maintiendra automatiquement la cohérence des données.
