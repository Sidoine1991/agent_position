# 🚀 Guide d'Installation - Presence CCRB

Ce guide vous aidera à installer et configurer le système Presence CCRB sur votre machine locale.

## 📋 Prérequis

### Logiciels requis
- **Node.js** : Version 18.0.0 ou supérieure
- **npm** : Version 8.0.0 ou supérieure
- **Git** : Pour cloner le repository
- **Navigateur moderne** : Chrome, Firefox, Safari, ou Edge

### Comptes requis
- **Supabase** : Pour la base de données (gratuit)
- **GitHub** : Pour cloner le code (optionnel)

## 🔧 Installation

### 1. Cloner le repository
```bash
git clone https://github.com/Sidoine1991/agent_position.git
cd agent_position
```

### 2. Installer les dépendances
```bash
npm install
```

### 3. Configuration de l'environnement

#### Créer le fichier de configuration
```bash
# Copier le fichier d'exemple
cp env.example .env

# Éditer le fichier .env avec vos paramètres
nano .env  # ou code .env, ou vim .env
```

#### Variables d'environnement requises
```env
# Configuration de base
NODE_ENV=development
PORT=3010

# Base de données Supabase (OBLIGATOIRE)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here

# JWT Secret (OBLIGATOIRE - générez une clé sécurisée)
JWT_SECRET=your-super-secure-jwt-secret-key-here

# URL publique de l'API
PUBLIC_BASE_URL=http://localhost:3010
```

### 4. Configuration de Supabase

#### Créer un projet Supabase
1. Allez sur [supabase.com](https://supabase.com)
2. Créez un compte gratuit
3. Créez un nouveau projet
4. Récupérez l'URL et la clé anonyme

#### Configurer la base de données
1. Allez dans l'éditeur SQL de Supabase
2. Exécutez le script `database/schema.sql`
3. Configurez les politiques RLS (Row Level Security)

### 5. Démarrer l'application
```bash
# Mode développement
npm run dev

# Ou mode production
npm start
```

L'application sera accessible sur : `http://localhost:3010`

## 🗄️ Configuration de la base de données

### Scripts SQL à exécuter
1. **Schema principal** : `database/schema.sql`
2. **Colonnes manquantes** : `add-missing-columns.sql`
3. **Données de test** : `populate-reports.sql`

### Ordre d'exécution
```sql
-- 1. Créer les tables
\i database/schema.sql

-- 2. Ajouter les colonnes manquantes
\i add-missing-columns.sql

-- 3. Peupler avec des données de test
\i populate-reports.sql
```

## 👥 Comptes de test

### Administrateur
- **Email** : `syebadokpo@gmail.com`
- **Mot de passe** : `123456`

### Compte de test
- **Email** : `admin@test.com`
- **Mot de passe** : `123456`

## 🧪 Tests

### Tests manuels
```bash
# Tester l'API
npm run test

# Tester l'interface
npm run test:ui

# Tests complets
npm run test:all
```

### Tests automatisés
```bash
# Tests unitaires
npm test

# Tests d'intégration
npm run test:integration
```

## 🚀 Déploiement

### Déploiement local
```bash
# Build de production
npm run build

# Démarrer en production
NODE_ENV=production npm start
```

### Déploiement Vercel
1. Connectez votre repository GitHub à Vercel
2. Configurez les variables d'environnement
3. Déployez automatiquement

### Déploiement Render
1. Connectez votre repository GitHub à Render
2. Configurez les variables d'environnement
3. Déployez automatiquement

## 🔧 Configuration avancée

### Variables d'environnement optionnelles
```env
# Email (optionnel)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# API externe (optionnel)
SERPAPI_KEY=your-serpapi-key-here

# Configuration CORS
CORS_ORIGIN=http://localhost:3010,https://your-domain.com

# Configuration de sécurité
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Configuration de géolocalisation
DEFAULT_TOLERANCE_RADIUS=50000
DEFAULT_LATITUDE=6.3725
DEFAULT_LONGITUDE=2.3542
```

### Configuration PWA
Le système est configuré comme une PWA (Progressive Web App) :
- Service Worker automatique
- Manifest configuré
- Installation sur mobile possible

## 🐛 Dépannage

### Problèmes courants

#### "Cannot find module"
```bash
# Réinstaller les dépendances
rm -rf node_modules package-lock.json
npm install
```

#### "Database connection failed"
- Vérifiez vos variables d'environnement Supabase
- Vérifiez que votre projet Supabase est actif
- Vérifiez les politiques RLS

#### "JWT Secret not found"
- Assurez-vous d'avoir configuré `JWT_SECRET` dans votre `.env`
- Utilisez une clé sécurisée de 128 caractères minimum

#### "Port already in use"
```bash
# Changer le port dans .env
PORT=3011

# Ou tuer le processus
lsof -ti:3010 | xargs kill -9
```

### Logs et debug
```bash
# Activer les logs détaillés
DEBUG=* npm start

# Logs spécifiques
DEBUG=presence:* npm start
```

## 📞 Support

### En cas de problème
1. **Consultez ce guide** en premier
2. **Vérifiez les logs** de l'application
3. **Consultez les issues** GitHub
4. **Contactez le support** : conseil.riziculteurs.benin2006@gmail.com

### Ressources utiles
- [Documentation Supabase](https://supabase.com/docs)
- [Documentation Node.js](https://nodejs.org/docs)
- [Documentation Express](https://expressjs.com/)
- [Guide PWA](https://web.dev/progressive-web-apps/)

## 🎉 Félicitations !

Votre système Presence CCRB est maintenant installé et configuré !

### Prochaines étapes
1. **Testez l'application** avec les comptes de test
2. **Configurez vos agents** dans l'interface d'administration
3. **Testez la géolocalisation** sur mobile
4. **Générez vos premiers rapports**

---

**Développé par Sidoine Kolaolé YEBADOKPO**  
*Data Analyst | Web Developer Fullstack | MEAL Officer*

- 📧 Email : conseil.riziculteurs.benin2006@gmail.com
- 💼 LinkedIn : [Sidoine YEBADOKPO](https://linkedin.com/in/sidoine-yebadokpo)
- 🏢 Organisation : Conseil de Concertation des Riziculteurs du Bénin (CCRB)
