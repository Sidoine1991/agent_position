# Déploiement sur Render

## Configuration requise

### Variables d'environnement à configurer dans Render :

1. **NODE_ENV** = `production`
2. **PORT** = `10000` (Render utilise ce port)
3. **SUPABASE_URL** = Votre URL Supabase
4. **SUPABASE_ANON_KEY** = Votre clé anonyme Supabase
5. **SUPABASE_SERVICE_ROLE_KEY** = Votre clé service role Supabase
6. **FRONTEND_URL** = URL de votre frontend déployé

## Étapes de déploiement

### 1. Préparer le repository
```bash
# S'assurer que le code est sur GitHub
git add .
git commit -m "Prepare for Render deployment"
git push origin main
```

### 2. Créer un service sur Render

1. Aller sur [render.com](https://render.com)
2. Se connecter avec GitHub
3. Cliquer sur "New +" → "Web Service"
4. Connecter votre repository GitHub
5. Sélectionner le dossier `backend-modern`

### 3. Configuration du service

- **Name**: `presence-ccrb-backend`
- **Environment**: `Node`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Plan**: `Free`

### 4. Variables d'environnement

Ajouter toutes les variables listées ci-dessus dans l'onglet "Environment"

### 5. Déploiement

- Cliquer sur "Create Web Service"
- Render va automatiquement construire et déployer votre application
- L'URL sera générée automatiquement (ex: `https://presence-ccrb-backend.onrender.com`)

## Test du déploiement

Une fois déployé, tester avec :
```bash
curl https://votre-app.onrender.com/health
```

## Logs et monitoring

- Les logs sont disponibles dans l'onglet "Logs" de Render
- Le service redémarre automatiquement en cas de crash
- Les déploiements sont automatiques à chaque push sur la branche main

## Mise à jour

Pour mettre à jour l'application :
```bash
git add .
git commit -m "Update application"
git push origin main
```

Render redéploiera automatiquement.
