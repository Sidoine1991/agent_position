# Presence CCRB - Déploiement Render

## 🚀 Déploiement sur Render

Cette application est configurée pour être déployée automatiquement sur Render.

### Configuration

- **Type** : Web Service
- **Runtime** : Node.js 18+
- **Build Command** : `npm install`
- **Start Command** : `node server.js`
- **Port** : 10000 (géré automatiquement par Render)

### Variables d'environnement

- `NODE_ENV=production`
- `PORT=10000` (géré automatiquement)

### Structure

```
/
├── server.js          # Serveur Express principal
├── web/              # Frontend (HTML, CSS, JS)
├── package.json      # Dépendances Node.js
├── render.yaml       # Configuration Render
└── README_RENDER.md  # Ce fichier
```

### Fonctionnalités

- ✅ Authentification utilisateur
- ✅ Gestion des rôles (admin, superviseur, agent)
- ✅ Système de présence
- ✅ Rapports et statistiques
- ✅ Interface responsive
- ✅ PWA ready

### URLs

- **Production** : https://presence-ccrb.onrender.com
- **Health Check** : https://presence-ccrb.onrender.com/api/health

### Support

Pour toute question ou problème, contactez l'équipe de développement.
