# ⚡ Déploiement Rapide - Presence CCRB

## 🚀 Déploiement en 5 minutes

### Option 1 : Vercel (Recommandé)

1. **Fork ce repository** sur GitHub
2. **Aller sur [vercel.com](https://vercel.com)**
3. **Se connecter avec GitHub**
4. **Importer le projet** `presence-ccrb`
5. **Déployer** - C'est tout ! 🎉

### Option 2 : Netlify + Railway

#### Frontend (Netlify)
1. Aller sur [netlify.com](https://netlify.com)
2. "New site from Git" → GitHub → `presence-ccrb`
3. Build command: `npm run build`
4. Publish directory: `web`

#### Backend (Railway)
1. Aller sur [railway.app](https://railway.app)
2. "Deploy from GitHub repo" → `presence-ccrb`
3. Root directory: `backend`

## 🔧 Configuration Rapide

### Variables d'environnement importantes
```env
NODE_ENV=production
JWT_SECRET=changez-cette-cle-secrete
CORS_ORIGIN=https://votre-domaine.com
```

### Base de données
- **Vercel** : SQLite automatique
- **Railway** : PostgreSQL gratuit
- **Netlify** : Utiliser une DB externe

## 📱 Test de l'application

1. **Ouvrir l'URL** de déploiement
2. **Créer un compte** administrateur
3. **Tester la géolocalisation**
4. **Vérifier les notifications**

## 🆓 Coûts

| Service | Gratuit | Limites |
|---------|---------|---------|
| Vercel | ✅ | 100GB/mois |
| Netlify | ✅ | 100GB/mois |
| Railway | ✅ | $5 crédit/mois |

## 🆘 Support

- **Documentation complète** : `DEPLOYMENT.md`
- **Issues** : Créer une issue sur GitHub
- **Email** : support@ccrb.bj

## 🎯 Prochaines étapes

1. ✅ Déployer l'application
2. 🔧 Configurer les variables d'environnement
3. 🧪 Tester toutes les fonctionnalités
4. 📧 Inviter les utilisateurs
5. 📊 Surveiller les performances

---

**Temps estimé** : 5-10 minutes  
**Coût** : 0€  
**Difficulté** : Facile ⭐
