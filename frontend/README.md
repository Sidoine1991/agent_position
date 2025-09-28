# Presence CCR-B - Frontend

Application React moderne pour la gestion de présence des agents CCR-B.

## 🚀 Technologies

- **React 18** avec TypeScript
- **Vite** pour le build et le développement
- **Tailwind CSS** pour le styling
- **React Router** pour la navigation
- **Supabase** pour l'authentification et la base de données
- **Workbox** pour les fonctionnalités PWA
- **Leaflet** pour les cartes

## 📦 Installation

```bash
# Installer les dépendances
npm install

# Copier le fichier d'environnement
cp env.example .env

# Configurer les variables d'environnement
# VITE_SUPABASE_URL=your-supabase-url
# VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
# VITE_API_BASE_URL=http://localhost:3001
```

## 🛠️ Développement

```bash
# Démarrer le serveur de développement
npm run dev

# Vérifier les types TypeScript
npm run type-check

# Linter le code
npm run lint
```

## 🏗️ Build

```bash
# Build de production
npm run build

# Prévisualiser le build
npm run preview
```

## 📱 Fonctionnalités PWA

- **Service Worker** avec Workbox pour la mise en cache
- **Manifest** pour l'installation sur mobile
- **Offline support** avec cache stratégique
- **Push notifications** (en cours de développement)

## 🎨 Design System

### Couleurs
- **Primary**: Bleu (#0ea5e9)
- **Secondary**: Violet (#d946ef)
- **Accent**: Vert (#22c55e)
- **Neutral**: Gris (#737373)

### Composants
- **Cards**: Cartes avec ombres douces
- **Buttons**: Boutons avec états hover/focus
- **Forms**: Inputs avec validation
- **Navigation**: Sidebar responsive

## 🔧 Configuration

### Tailwind CSS
Configuration personnalisée dans `tailwind.config.js` avec :
- Couleurs personnalisées
- Animations
- Ombres douces
- Typographie

### Vite
Configuration dans `vite.config.ts` avec :
- Support TypeScript
- Alias de chemins
- Configuration de build

## 📁 Structure

```
src/
├── components/     # Composants réutilisables
├── hooks/         # Hooks personnalisés
├── pages/         # Pages de l'application
├── utils/         # Utilitaires et configuration
└── index.css      # Styles globaux
```

## 🚀 Déploiement

L'application est prête pour le déploiement sur :
- **Vercel** (recommandé)
- **Netlify**
- **GitHub Pages**
- **Railway**

## 📝 Notes

- L'application utilise Supabase pour l'authentification
- Le Service Worker est généré automatiquement lors du build
- Les images sont optimisées et mises en cache
- Support complet du mode hors ligne
