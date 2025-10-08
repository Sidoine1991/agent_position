# 🤝 Guide de Contribution - Presence CCRB

Merci de votre intérêt à contribuer au projet **Presence CCRB** ! Ce guide vous aidera à comprendre comment participer efficacement au développement de cette solution de suivi de présence des agents de terrain.

## 🎯 À propos du projet

**Presence CCRB** est un système de géolocalisation et de suivi des agents de terrain développé pour le **Conseil de Concertation des Riziculteurs du Bénin (CCRB)**. Il permet de vérifier la présence réelle des agents sur leurs zones d'intervention grâce à la géolocalisation GPS.

## 🚀 Comment contribuer

### 1. Fork et Clone
```bash
# Fork le repository sur GitHub
# Puis clonez votre fork
git clone https://github.com/VOTRE-USERNAME/presence_ccrb.git
cd presence_ccrb
```

### 2. Configuration de l'environnement
```bash
# Installer les dépendances
npm install

# Créer un fichier .env.local pour vos tests
cp .env.example .env.local
# Éditez .env.local avec vos propres clés de test
```

### 3. Créer une branche
```bash
# Créer une nouvelle branche pour votre fonctionnalité
git checkout -b feature/nom-de-votre-fonctionnalite
# ou
git checkout -b fix/nom-du-bug
```

### 4. Développement
- Codez votre fonctionnalité ou correction
- Testez localement
- Suivez les conventions de code (voir section ci-dessous)

### 5. Commit et Push
```bash
# Ajouter vos changements
git add .

# Commit avec un message descriptif
git commit -m "feat: ajouter fonctionnalité de notification push"

# Push vers votre fork
git push origin feature/nom-de-votre-fonctionnalite
```

### 6. Pull Request
- Créez une Pull Request sur GitHub
- Décrivez clairement vos changements
- Attendez la review du mainteneur

## 📋 Types de contributions

### 🐛 Bug Reports
- Utilisez le template d'issue "Bug Report"
- Décrivez clairement le problème
- Incluez les étapes pour reproduire
- Mentionnez votre environnement (navigateur, OS, etc.)

### ✨ Nouvelles fonctionnalités
- Ouvrez d'abord une issue pour discuter
- Décrivez la fonctionnalité proposée
- Expliquez l'utilité pour les utilisateurs
- Attendez l'approbation avant de coder

### 📚 Amélioration de la documentation
- Corrections de typos
- Amélioration des guides
- Ajout d'exemples
- Traduction en d'autres langues

### 🎨 Amélioration de l'interface
- Amélioration du design mobile
- Optimisation de l'UX
- Accessibilité
- Responsive design

## 🛠️ Conventions de code

### Structure du projet
```
presence_ccrb/
├── web/                    # Interface utilisateur
│   ├── *.html             # Pages HTML
│   ├── *.js               # JavaScript
│   ├── *.css              # Styles
│   └── Media/             # Images et assets
├── server.js              # Serveur principal
├── api/                   # API endpoints
└── docs/                  # Documentation
```

### Conventions JavaScript
```javascript
// Utilisez des noms de variables descriptifs
const userLocation = getCurrentPosition();

// Utilisez camelCase pour les variables et fonctions
function calculateDistance(lat1, lon1, lat2, lon2) {
    // Code...
}

// Utilisez des commentaires pour expliquer la logique complexe
// Calcul de la distance de Haversine entre deux points GPS
function haversineDistance(lat1, lon1, lat2, lon2) {
    // Implementation...
}
```

### Conventions CSS
```css
/* Utilisez des classes descriptives */
.navbar-link {
    /* Styles de base */
}

.navbar-link:hover {
    /* Styles au survol */
}

.navbar-link-active {
    /* Styles pour l'état actif */
}

/* Commentaires pour les sections importantes */
/* === Navigation Mobile === */
@media (max-width: 768px) {
    /* Styles mobile */
}
```

### Conventions de commit
Utilisez le format conventionnel :
- `feat:` nouvelle fonctionnalité
- `fix:` correction de bug
- `docs:` documentation
- `style:` formatage, point-virgules manquants, etc.
- `refactor:` refactoring du code
- `test:` ajout de tests
- `chore:` maintenance

Exemples :
```bash
git commit -m "feat: ajouter validation GPS en temps réel"
git commit -m "fix: corriger affichage mobile du navbar"
git commit -m "docs: mettre à jour le guide d'installation"
```

## 🧪 Tests

### Tests manuels
1. **Testez sur différents navigateurs** (Chrome, Firefox, Safari, Edge)
2. **Testez sur mobile** (Android, iOS)
3. **Testez les fonctionnalités principales** :
   - Connexion/déconnexion
   - Marquage de présence
   - Géolocalisation
   - Génération de rapports

### Tests automatiques (à venir)
```bash
# Quand les tests seront implémentés
npm test
npm run test:coverage
```

## 📝 Documentation

### Mise à jour du README
- Gardez le README à jour avec les nouvelles fonctionnalités
- Ajoutez des captures d'écran si nécessaire
- Maintenez la structure claire et accessible

### Documentation du code
- Commentez les fonctions complexes
- Utilisez JSDoc pour les fonctions JavaScript
- Expliquez les algorithmes de géolocalisation

## 🔒 Sécurité

### Fichiers sensibles
- **NE COMMITTEZ JAMAIS** :
  - Fichiers `.env`
  - Clés API
  - Mots de passe
  - Certificats
  - Données de production

### Bonnes pratiques
- Validez toutes les entrées utilisateur
- Utilisez des requêtes préparées pour la base de données
- Implémentez une authentification robuste
- Respectez les politiques CORS

## 🐛 Signaler un bug

### Template de bug report
```markdown
**Description du bug**
Une description claire du problème.

**Étapes pour reproduire**
1. Aller à '...'
2. Cliquer sur '...'
3. Voir l'erreur

**Comportement attendu**
Ce qui devrait se passer.

**Comportement actuel**
Ce qui se passe réellement.

**Screenshots**
Si applicable, ajoutez des captures d'écran.

**Environnement**
- OS: [ex: Windows 10, macOS, Ubuntu]
- Navigateur: [ex: Chrome 91, Firefox 89]
- Version: [ex: 1.2.3]

**Informations additionnelles**
Tout autre contexte utile.
```

## ✨ Proposer une fonctionnalité

### Template de feature request
```markdown
**Fonctionnalité proposée**
Une description claire de la fonctionnalité.

**Problème résolu**
Quel problème cette fonctionnalité résout-elle ?

**Solution proposée**
Comment proposez-vous de l'implémenter ?

**Alternatives considérées**
D'autres solutions que vous avez envisagées.

**Contexte additionnel**
Tout autre contexte ou screenshots.
```

## 📞 Support

### Questions techniques
- Ouvrez une issue avec le label "question"
- Utilisez les discussions GitHub si disponibles
- Contactez le mainteneur : conseil.riziculteurs.benin2006@gmail.com

### Contact du mainteneur
- **Nom** : Sidoine Kolaolé YEBADOKPO
- **Titre** : Data Analyst | Web Developer Fullstack | MEAL Officer
- **Email** : conseil.riziculteurs.benin2006@gmail.com
- **LinkedIn** : [Sidoine YEBADOKPO](https://linkedin.com/in/sidoine-yebadokpo)

## 🎉 Reconnaissance

Tous les contributeurs seront mentionnés dans :
- Le fichier CONTRIBUTORS.md
- Les notes de version
- La documentation du projet

## 📄 Licence

En contribuant à ce projet, vous acceptez que vos contributions soient sous la même licence que le projet (voir LICENSE.md).

---

**Merci de contribuer à Presence CCRB !** 🚀

*Votre contribution aide à améliorer le suivi des agents de terrain au Bénin.*
