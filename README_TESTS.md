# 🧪 Tests Automatisés - Presence CCRB

## 📋 **Vue d'ensemble**

Ce projet inclut une suite de tests automatisés utilisant **Playwright** pour valider toutes les fonctionnalités de l'application Presence CCRB.

## 🚀 **Installation**

### **1. Installer les dépendances**
```bash
npm install
```

### **2. Installer Playwright**
```bash
npx playwright install
```

## 🎯 **Types de Tests**

### **Tests Fonctionnels**
- ✅ **Page d'accueil** : Chargement et éléments principaux
- ✅ **Authentification** : Connexion avec credentials
- ✅ **GPS/Géolocalisation** : Fonctionnalité de localisation
- ✅ **Interface mobile** : Responsive design
- ✅ **Performance** : Temps de chargement
- ✅ **PWA** : Manifest et Service Worker
- ✅ **API** : Endpoints de santé et connexion
- ✅ **Sécurité** : Headers de sécurité
- ✅ **Compatibilité** : Support des navigateurs
- ✅ **Déploiement** : Tests Vercel et Render

### **Tests Multi-Navigateurs**
- 🌐 **Chrome** (Chromium)
- 🦊 **Firefox**
- 🍎 **Safari** (WebKit)
- 📱 **Mobile Chrome**
- 📱 **Mobile Safari**

## 🏃‍♂️ **Exécution des Tests**

### **Commandes Disponibles**

```bash
# Test local (Chrome uniquement)
npm run test:local

# Test sur tous les navigateurs
npm run test:all

# Test mobile uniquement
npm run test:mobile

# Test spécifique Vercel
npm run test:vercel

# Test avec interface graphique
npm run test:ui

# Test par défaut
npm test
```

### **Exemples d'Utilisation**

```bash
# Test rapide local
npm run test:local

# Test complet multi-navigateurs
npm run test:all

# Test mobile pour validation PWA
npm run test:mobile

# Test de déploiement Vercel
npm run test:vercel
```

## 📊 **Résultats des Tests**

### **Dossiers de Sortie**
- `test-results/` : Résultats principaux
- `test-results/html/` : Rapport HTML interactif
- `test-results/results.json` : Résultats JSON
- `test-results/results.xml` : Résultats JUnit
- `test-results/summary.json` : Résumé des tests

### **Screenshots et Vidéos**
- Screenshots automatiques en cas d'échec
- Vidéos des tests échoués
- Traces pour le debugging

## 🔧 **Configuration**

### **Variables d'Environnement**
```bash
# URL de test (défaut: http://localhost:3000)
TEST_URL=http://localhost:3000

# URL Render (optionnel)
RENDER_URL=https://presence-ccrb.onrender.com

# Mode CI (désactive l'interface)
CI=true
```

### **Credentials de Test**
Les tests utilisent les credentials par défaut :
- **Email** : `ntchaostelle4@gmail.com`
- **Mot de passe** : `123456`

## 📱 **Tests Spécifiques**

### **Test GPS**
- Simulation de géolocalisation
- Coordonnées du Bénin (9.3077, 2.3158)
- Validation des permissions

### **Test Mobile**
- Viewport mobile (375x667)
- Responsive design
- Touch interactions

### **Test PWA**
- Manifest validation
- Service Worker detection
- Offline capabilities

### **Test Performance**
- Temps de chargement < 5s
- Network idle detection
- Resource loading

## 🐛 **Debugging**

### **Mode Debug**
```bash
# Activer les logs détaillés
DEBUG=pw:api npx playwright test

# Mode headful (voir le navigateur)
npx playwright test --headed

# Mode slow (ralentir les actions)
npx playwright test --slow
```

### **Interface Graphique**
```bash
# Ouvrir l'interface de test
npm run test:ui
```

## 📈 **Intégration CI/CD**

### **GitHub Actions**
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npx playwright install
      - run: npm run test:all
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: test-results
          path: test-results/
```

## 🎯 **Bonnes Pratiques**

### **Écriture de Tests**
- Tests indépendants
- Nettoyage après chaque test
- Screenshots en cas d'échec
- Messages de debug clairs

### **Maintenance**
- Mise à jour régulière des sélecteurs
- Validation des credentials de test
- Monitoring des performances
- Documentation des changements

## 📞 **Support**

### **Problèmes Courants**
1. **Serveur non accessible** : Vérifier que `npm start` fonctionne
2. **Credentials invalides** : Vérifier la base de données
3. **Tests lents** : Réduire le timeout ou optimiser l'app
4. **Screenshots manquants** : Vérifier les permissions d'écriture

### **Logs et Debugging**
- Console du navigateur
- Logs Playwright
- Screenshots d'erreur
- Traces de performance

---

**🎉 Tests automatisés prêts ! Lancez `npm test` pour commencer !**
