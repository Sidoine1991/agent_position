# 📍 Presence CCRB - Système de Suivi des Agents Terrain v2.0.0

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)](https://expressjs.com/)
[![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)
[![SQLite](https://img.shields.io/badge/SQLite-07405E?style=for-the-badge&logo=sqlite&logoColor=white)](https://www.sqlite.org/)

## 🎯 Vue d'ensemble

**Presence CCRB v2.0.0** est une solution moderne et robuste de géolocalisation et de suivi des agents de terrain pour le Centre de Coordination de la Recherche sur le Riz (CCRB). Cette version modernisée intègre les meilleures pratiques de développement 2025 avec TypeScript, une architecture modulaire, et des fonctionnalités avancées.

## ✨ Nouvelles Fonctionnalités v2.0.0

### 🏗️ Architecture Modernisée
- **TypeScript strict** avec validation de types complète
- **Architecture modulaire** avec séparation des responsabilités
- **Gestion d'erreurs robuste** avec logging avancé
- **Validation des données** avec Zod
- **Sécurité renforcée** avec Helmet et Rate Limiting
- **Monitoring intégré** avec Winston et métriques

### 🚀 Performance & Scalabilité
- **Compression** des réponses HTTP
- **Cache intelligent** pour les requêtes fréquentes
- **Optimisation** des requêtes base de données
- **Bundle splitting** pour le frontend
- **Lazy loading** des composants

### 🔒 Sécurité Avancée
- **Rate limiting** par IP et utilisateur
- **Validation stricte** des entrées
- **Headers de sécurité** (CSP, HSTS, etc.)
- **Sanitisation** des données
- **Logging des tentatives** d'intrusion

### 📊 Monitoring & Observabilité
- **Logs structurés** avec Winston
- **Métriques de performance** en temps réel
- **Health checks** détaillés
- **Monitoring des erreurs** avec stack traces
- **Alertes automatiques** pour les problèmes critiques

## 🏗️ Architecture Technique

### Backend (Node.js + Express + TypeScript)
```
backend/
├── src/
│   ├── config/          # Configuration centralisée
│   ├── controllers/     # Contrôleurs métier
│   ├── services/        # Logique métier
│   ├── repositories/    # Accès aux données
│   ├── middleware/      # Middlewares personnalisés
│   ├── validators/      # Validation Zod
│   ├── types/          # Types TypeScript
│   ├── utils/          # Utilitaires
│   └── tests/          # Tests unitaires
├── data/               # Base de données SQLite
└── logs/               # Fichiers de logs
```

### Frontend (PWA + TypeScript)
```
web/
├── components/         # Composants réutilisables
├── pages/             # Pages de l'application
├── services/          # Services API
├── utils/             # Utilitaires
├── types/             # Types TypeScript
└── assets/            # Ressources statiques
```

## 🚀 Installation & Démarrage

### Prérequis
- **Node.js** 18+ (recommandé: 20+)
- **npm** 9+ ou **yarn** 1.22+
- **Git** 2.30+

### Installation Rapide
```bash
# Cloner le repository
git clone https://github.com/Sidoine1991/agent_position.git
cd agent_position

# Installation des dépendances
npm install

# Configuration de l'environnement
cp env.example .env
# Éditer .env avec vos paramètres

# Migration de la base de données
npm run db:migrate

# Démarrage en développement
npm run dev
```

### Scripts Disponibles

#### Développement
```bash
npm run dev              # Démarrage complet (backend + frontend)
npm run dev:backend      # Backend uniquement
npm run dev:frontend     # Frontend uniquement
```

#### Build & Production
```bash
npm run build            # Build complet
npm run build:backend    # Build backend
npm run build:frontend   # Build frontend
npm start               # Démarrage production
```

#### Tests & Qualité
```bash
npm test                # Tests complets
npm run test:backend    # Tests backend
npm run test:frontend   # Tests frontend
npm run lint            # Vérification du code
npm run format          # Formatage du code
npm run type-check      # Vérification des types
```

#### Base de Données
```bash
npm run db:migrate      # Migration
npm run db:seed         # Données de test
npm run db:reset        # Reset complet
```

## 🌐 Déploiement

### Déploiement Automatique (Vercel)
```bash
# Déploiement modernisé
./deploy-modern.ps1

# Ou avec options
./deploy-modern.ps1 -Environment production -SkipTests
```

### Déploiement Manuel
```bash
# Build
npm run build

# Tests
npm test

# Déploiement
git add .
git commit -m "Deploy: v2.0.0"
git push origin main
```

## 📊 API Documentation

### Endpoints Principaux

#### Authentification
```
POST /api/auth/login     # Connexion
POST /api/auth/register  # Inscription
POST /api/auth/logout    # Déconnexion
GET  /api/auth/profile   # Profil utilisateur
```

#### Agents
```
GET    /api/agents           # Liste des agents
POST   /api/agents           # Créer un agent
GET    /api/agents/:id       # Détails d'un agent
PUT    /api/agents/:id       # Modifier un agent
DELETE /api/agents/:id       # Supprimer un agent
```

#### Présence
```
GET    /api/presence         # Historique des présences
POST   /api/presence         # Enregistrer une présence
GET    /api/presence/:id     # Détails d'une présence
PUT    /api/presence/:id     # Modifier une présence
```

#### Dashboard
```
GET /api/dashboard/stats     # Statistiques
GET /api/dashboard/agents    # Agents actifs
GET /api/dashboard/reports   # Rapports
```

### Exemple de Requête
```typescript
// Connexion
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'admin@ccrb.local',
    password: '123456'
  })
});

const data = await response.json();
// { success: true, token: "...", user: {...} }
```

## 🔧 Configuration

### Variables d'Environnement
```env
# Application
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# Base de données
DATABASE_PATH=./data/app.db

# JWT
JWT_SECRET=your-super-secret-key-32-chars-min
JWT_EXPIRES_IN=24h

# CORS
CORS_ORIGIN=https://agent-position.vercel.app

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# Upload
UPLOAD_MAX_SIZE=10485760
UPLOAD_ALLOWED_TYPES=image/jpeg,image/png,image/webp

# Monitoring
LOG_LEVEL=info
```

## 🧪 Tests

### Structure des Tests
```
tests/
├── unit/              # Tests unitaires
├── integration/       # Tests d'intégration
├── e2e/              # Tests end-to-end
└── fixtures/         # Données de test
```

### Exécution des Tests
```bash
# Tous les tests
npm test

# Tests avec couverture
npm run test:coverage

# Tests en mode watch
npm run test:watch

# Tests UI (interface graphique)
npm run test:ui
```

## 📈 Monitoring & Logs

### Health Checks
```bash
# Santé basique
curl https://agent-position.vercel.app/api/health

# Santé détaillée
curl https://agent-position.vercel.app/api/health/detailed
```

### Logs
- **Développement**: Console colorée
- **Production**: Fichiers dans `logs/`
- **Niveaux**: error, warn, info, debug

### Métriques
- **Uptime**: Temps de fonctionnement
- **Memory**: Utilisation mémoire
- **Performance**: Temps de réponse
- **Errors**: Taux d'erreur

## 🔒 Sécurité

### Mesures Implémentées
- ✅ **Rate Limiting** (100 req/15min)
- ✅ **CORS** configuré
- ✅ **Helmet** (headers sécurité)
- ✅ **Validation** stricte des données
- ✅ **Sanitisation** des entrées
- ✅ **JWT** sécurisé
- ✅ **Logging** des tentatives d'intrusion
- ✅ **Compression** des réponses

### Bonnes Pratiques
- 🔐 Mots de passe forts (bcrypt)
- 🔐 Tokens JWT avec expiration
- 🔐 Validation côté serveur
- 🔐 Headers de sécurité
- 🔐 Logs de sécurité

## 🚀 Performance

### Optimisations
- ⚡ **Compression** gzip
- ⚡ **Cache** intelligent
- ⚡ **Index** base de données
- ⚡ **Bundle splitting**
- ⚡ **Lazy loading**
- ⚡ **Image optimization**

### Métriques Cibles
- **Lighthouse Score**: > 90
- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Cumulative Layout Shift**: < 0.1

## 🤝 Contribution

### Workflow
1. **Fork** le repository
2. **Créer** une branche feature
3. **Développer** avec les standards
4. **Tester** votre code
5. **Soumettre** une Pull Request

### Standards de Code
- **TypeScript** strict
- **ESLint** + **Prettier**
- **Tests** obligatoires
- **Documentation** à jour
- **Commits** conventionnels

## 📞 Support

### Documentation
- 📖 [Guide de déploiement](DEPLOYMENT.md)
- 📖 [Plan de modernisation](MODERNIZATION_PLAN.md)
- 📖 [API Documentation](docs/api.md)

### Contact
- 🐛 **Issues**: [GitHub Issues](https://github.com/Sidoine1991/agent_position/issues)
- 📧 **Email**: support@ccrb.bj
- 💬 **Discussions**: [GitHub Discussions](https://github.com/Sidoine1991/agent_position/discussions)

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 🙏 Remerciements

- **CCRB** pour la confiance
- **Communauté** open source
- **Contributeurs** du projet
- **Vercel** pour l'hébergement

---

**Développé avec ❤️ pour le CCRB - Version 2.0.0 - 2025**
