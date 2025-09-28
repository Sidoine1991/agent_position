# Presence CCR-B - Backend API

API moderne pour la gestion de présence des agents CCR-B, construite avec Node.js, Express et TypeScript.

## 🚀 Technologies

- **Node.js** avec TypeScript
- **Express.js** pour le framework web
- **Supabase** pour l'authentification et la base de données
- **JWT** pour l'authentification
- **Helmet** pour la sécurité
- **CORS** pour la gestion des origines croisées
- **Morgan** pour le logging

## 📦 Installation

```bash
# Installer les dépendances
npm install

# Copier le fichier d'environnement
cp env.example .env

# Configurer les variables d'environnement
# SUPABASE_URL=your-supabase-url
# SUPABASE_ANON_KEY=your-supabase-anon-key
# JWT_SECRET=your-jwt-secret-key
```

## 🛠️ Développement

```bash
# Installer les dépendances
npm install

# Configurer les variables d'environnement
cp env.example .env
# Éditer .env avec vos valeurs

# Configurer la base de données
npm run setup-db

# Démarrer le serveur de développement
npm run dev

# Build de production
npm run build

# Démarrer le serveur de production
npm start

# Tester l'API
node test-api.js
```

## 📚 API Endpoints

### Authentification
- `POST /api/auth/login` - Connexion
- `POST /api/auth/register` - Inscription
- `POST /api/auth/logout` - Déconnexion
- `POST /api/auth/refresh` - Rafraîchir le token

### Utilisateurs
- `GET /api/users` - Liste des utilisateurs (admin)
- `GET /api/users/:id` - Détails d'un utilisateur
- `PUT /api/users/:id` - Mettre à jour un utilisateur
- `DELETE /api/users/:id` - Supprimer un utilisateur (admin)

### Présence
- `POST /api/presence` - Marquer la présence
- `GET /api/presence/my` - Mes enregistrements de présence
- `GET /api/presence` - Tous les enregistrements (admin/supervisor)
- `GET /api/presence/stats` - Statistiques de présence

### Rapports
- `POST /api/reports` - Générer un rapport
- `GET /api/reports` - Liste des rapports
- `GET /api/reports/:id` - Détails d'un rapport
- `DELETE /api/reports/:id` - Supprimer un rapport

### Missions
- `POST /api/missions` - Créer une mission
- `GET /api/missions` - Liste des missions (avec filtres)
- `GET /api/missions/my` - Mes missions
- `GET /api/missions/:id` - Détails d'une mission
- `PUT /api/missions/:id` - Mettre à jour une mission
- `DELETE /api/missions/:id` - Supprimer une mission

## 🔐 Authentification

L'API utilise JWT pour l'authentification. Incluez le token dans l'en-tête Authorization :

```
Authorization: Bearer <your-jwt-token>
```

## 📊 Rôles

- **admin** : Accès complet à toutes les fonctionnalités
- **supervisor** : Accès aux rapports et statistiques
- **agent** : Accès limité à ses propres données

## 🛡️ Sécurité

- **Helmet** pour les en-têtes de sécurité
- **CORS** configuré pour le frontend
- **Rate limiting** pour prévenir les abus
- **Validation** des données d'entrée
- **Authentification** JWT obligatoire

## 📝 Structure du Projet

```
src/
├── controllers/     # Contrôleurs de l'API
│   ├── authController.ts
│   ├── userController.ts
│   ├── presenceController.ts
│   ├── reportController.ts
│   └── missionController.ts
├── middleware/      # Middleware personnalisés
│   ├── auth.ts
│   ├── errorHandler.ts
│   └── rateLimiter.ts
├── routes/         # Définition des routes
│   ├── auth.ts
│   ├── users.ts
│   ├── presence.ts
│   ├── reports.ts
│   └── missions.ts
├── services/       # Services métier
│   ├── authService.ts
│   ├── presenceService.ts
│   └── databaseService.ts
├── types/          # Types TypeScript
│   └── index.ts
├── utils/          # Utilitaires
│   ├── validation.ts
│   ├── response.ts
│   └── logger.ts
└── index.ts        # Point d'entrée

database/
├── schema.sql      # Schéma complet de la base de données
└── migrations/     # Fichiers de migration
    ├── 001_initial_schema.sql
    ├── 002_rls_policies.sql
    └── 003_user_handling.sql

scripts/
└── setup-database.js  # Script de configuration de la base de données
```

## 🚀 Déploiement

L'API est prête pour le déploiement sur :
- **Railway**
- **Render**
- **Heroku**
- **Vercel**
- **AWS**

## 📝 Notes

- L'API utilise Supabase pour l'authentification et la base de données
- Tous les endpoints nécessitent une authentification (sauf /health)
- Les réponses suivent un format standardisé avec success/error
- La pagination est supportée pour les listes
