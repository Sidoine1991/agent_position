# 🚀 Guide de Déploiement - Presence CCRB

## Solutions d'Hébergement Gratuites

### Option 1 : Vercel (Recommandé) ⭐

#### Prérequis
- Compte GitHub
- Compte Vercel (gratuit)
- Node.js installé localement

#### Étapes de déploiement

1. **Préparer le repository GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/votre-username/presence-ccrb.git
   git push -u origin main
   ```

2. **Déployer sur Vercel**
   - Aller sur [vercel.com](https://vercel.com)
   - Se connecter avec GitHub
   - Cliquer "New Project"
   - Importer le repository `presence-ccrb`
   - Vercel détectera automatiquement la configuration

3. **Configurer les variables d'environnement**
   - Dans le dashboard Vercel, aller dans Settings > Environment Variables
   - Ajouter les variables du fichier `env.example`

4. **Déployer**
   - Vercel déploiera automatiquement
   - Votre app sera disponible à `https://presence-ccrb.vercel.app`

### Option 2 : Netlify + Railway

#### Frontend (Netlify)
1. Aller sur [netlify.com](https://netlify.com)
2. Connecter le repository GitHub
3. Configurer le build : `npm run build`
4. Publier le dossier `web/`

#### Backend (Railway)
1. Aller sur [railway.app](https://railway.app)
2. Connecter le repository GitHub
3. Sélectionner le dossier `backend/`
4. Configurer les variables d'environnement

### Option 3 : GitHub Pages (Frontend seulement)

1. Aller dans Settings > Pages du repository
2. Sélectionner "Deploy from a branch"
3. Choisir la branche `main` et le dossier `web/`
4. L'URL sera `https://votre-username.github.io/presence-ccrb`

## Configuration Post-Déploiement

### 1. Base de données
- Vercel : SQLite sera créé automatiquement
- Railway : Utiliser PostgreSQL gratuit
- Netlify : Utiliser une base de données externe

### 2. Variables d'environnement importantes
```env
NODE_ENV=production
JWT_SECRET=votre-secret-jwt-tres-securise
CORS_ORIGIN=https://votre-domaine.com
```

### 3. Configuration HTTPS
- Vercel : HTTPS automatique
- Netlify : HTTPS automatique
- GitHub Pages : HTTPS automatique

## Optimisations de Performance

### 1. Compression des assets
- Les fichiers `.htaccess` et `vercel.json` incluent la compression GZIP
- Les images sont optimisées automatiquement

### 2. Cache des navigateurs
- Headers de cache configurés pour les assets statiques
- Service Worker pour la mise en cache

### 3. CDN
- Vercel et Netlify incluent un CDN global
- Chargement rapide depuis le monde entier

## Surveillance et Maintenance

### 1. Logs
- Vercel : Logs disponibles dans le dashboard
- Railway : Logs en temps réel
- Netlify : Logs de build et de fonction

### 2. Sauvegarde
- Base de données : Exporter régulièrement
- Code : Sauvegardé automatiquement sur GitHub

### 3. Mises à jour
- Push sur GitHub = déploiement automatique
- Rollback possible depuis le dashboard

## Coûts

| Service | Gratuit | Limites |
|---------|---------|---------|
| Vercel | ✅ | 100GB bandwidth/mois |
| Netlify | ✅ | 100GB bandwidth/mois |
| Railway | ✅ | $5 crédit/mois |
| GitHub Pages | ✅ | Illimité |

## Support

- Documentation Vercel : https://vercel.com/docs
- Documentation Netlify : https://docs.netlify.com
- Documentation Railway : https://docs.railway.app

## Prochaines Étapes

1. Choisir une solution d'hébergement
2. Suivre les étapes de déploiement
3. Configurer les variables d'environnement
4. Tester l'application en production
5. Configurer un nom de domaine personnalisé (optionnel)
