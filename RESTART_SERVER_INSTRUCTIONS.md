# Instructions pour redémarrer le serveur

## Problème
Le tableau "Récapitulatif mensuel des présences" affiche "Aucune donnée de présence disponible" car le nouvel endpoint `/api/presences` n'est pas encore disponible.

## Solution
Redémarrer le serveur pour charger les modifications.

### Option 1 : Redémarrer via le terminal

```bash
# Arrêter le serveur actuel (Ctrl+C)
# Puis redémarrer :
npm start
```

### Option 2 : Arrêter et redémarrer manuellement

1. Trouver le process PID 40740 (ou le PID actuel du serveur)
2. Arrêter le serveur :
   ```bash
   # Sous Windows PowerShell (en tant qu'admin si nécessaire)
   taskkill /PID 40740 /F
   
   # Ou utiliser le gestionnaire de tâches Windows
   ```

3. Redémarrer le serveur :
   ```bash
   npm start
   ```

## Ce qui a été modifié

### 1. Nouvel endpoint API `/api/presences`
- Créé dans `server.js` (lignes 4973-5030)
- Permet de récupérer les données depuis la table `presences`
- Inclut les relations avec la table `users`

### 2. Fonction `updatePresenceSummary()` modifiée
- Dans `web/reports-backend.js` (lignes 2901-3037)
- Utilise maintenant `/api/presences` au lieu de `/reports/validations`
- Gère les cas où `within_tolerance` est `null` (considéré comme présent)

### 3. Logique de calcul
- Si `within_tolerance = true` → Jour présent
- Si `within_tolerance = false` → Jour absent  
- Si `within_tolerance = null` → Jour présent (anciennes données)

## Après le redémarrage

1. Ouvrir la page des rapports
2. Sélectionner Octobre 2025
3. Le tableau devrait maintenant afficher les agents avec leurs statistiques

## Vérification

Pour vérifier que l'endpoint fonctionne :

```bash
# Tester l'endpoint
curl http://localhost:3010/api/presences
```

Vous devriez recevoir une erreur 401 (non autorisé) au lieu de 404 (non trouvé).

