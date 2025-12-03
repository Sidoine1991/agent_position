# Guide des Tests Unitaires - Rapport Mensuel des Agents

## 📋 Vue d'ensemble

Cette suite de tests a été créée pour identifier et résoudre les problèmes de communication entre le frontend et le backend dans le système de rapport mensuel des agents.

## 🎯 Objectifs des Tests

Les tests permettent d'identifier :
- ❌ Erreurs de communication API (endpoints incorrects, paramètres manquants)
- ❌ Problèmes de transformation des données entre backend et frontend
- ❌ Erreurs de requêtes Supabase (colonnes manquantes, filtres incorrects)
- ❌ Problèmes de rendu des données dans le frontend
- ❌ Gestion incorrecte des erreurs et des cas limites

## 📁 Structure des Tests

```
tests/
├── setup.js                          # Configuration globale Vitest
├── mocks/
│   └── supabase.js                   # Mock du client Supabase
├── fixtures/
│   └── monthly-report-data.js        # Données de test réalistes
├── helpers/
│   └── test-utils.js                 # Utilitaires de test
├── unit/
│   ├── monthlyReport.test.js         # Tests backend (buildAgentMonthlyReport)
│   ├── server-api.test.js            # Tests API serveur
│   ├── agent-dashboard-api.test.js   # Tests appels API frontend
│   └── agent-dashboard-render.test.js # Tests rendu frontend
└── integration/
    └── monthly-report-flow.test.js   # Tests flux complet
```

## 🚀 Installation

```bash
# Installer les dépendances de test
npm install
```

## ▶️ Exécution des Tests

### Tous les tests
```bash
npm test
```

### Tests en mode watch (développement)
```bash
npm run test:watch
```

### Tests avec couverture de code
```bash
npm run test:coverage
```

### Tests backend uniquement
```bash
npm run test:backend
```

### Tests frontend uniquement
```bash
npm run test:frontend
```

### Tests d'intégration uniquement
```bash
npm run test:integration
```

## 📊 Couverture des Tests

### Tests Backend (`monthlyReport.test.js`)
- ✅ Construction du rapport mensuel avec données valides
- ✅ Gestion des agents inexistants
- ✅ Validation du format de mois
- ✅ Filtrage par nom de projet
- ✅ Calcul des statistiques de présence
- ✅ Gestion des check-ins vides
- ✅ Inclusion des permissions
- ✅ Gestion des erreurs Supabase
- ✅ Transformation des données

### Tests API Serveur (`server-api.test.js`)
- ✅ Validation des paramètres requis (agentId, month)
- ✅ Validation du format de mois
- ✅ Gestion du paramètre optionnel projectName
- ✅ Validation du token d'authentification
- ✅ Format de réponse correct
- ✅ Gestion des erreurs (404, 500, etc.)
- ✅ Validation des taux (0-100%)

### Tests Frontend API (`agent-dashboard-api.test.js`)
- ✅ Appels API avec paramètres corrects
- ✅ Gestion des réponses réussies
- ✅ Gestion des erreurs réseau
- ✅ Gestion des timeouts
- ✅ Transformation des données
- ✅ Fallback client-side
- ✅ Filtres (agent, projet, mois)
- ✅ États de chargement
- ✅ Cache des réponses

### Tests Rendu Frontend (`agent-dashboard-render.test.js`)
- ✅ Rendu des statistiques de présence
- ✅ Rendu des activités
- ✅ Rendu des photos et localisations
- ✅ Rendu du classement
- ✅ Gestion des données vides
- ✅ Échappement HTML (sécurité XSS)
- ✅ Indicateurs de chargement
- ✅ Messages d'erreur
- ✅ Formatage des données

### Tests d'Intégration (`monthly-report-flow.test.js`)
- ✅ Flux complet Frontend → Backend → Database
- ✅ Gestion des erreurs dans toute la chaîne
- ✅ Filtrage par projet et dates
- ✅ Cohérence des données
- ✅ Performance avec grands datasets
- ✅ Récupération après erreur
- ✅ Fallback en cas d'échec API

## 🔍 Interprétation des Résultats

### Tests Réussis ✅
Si tous les tests passent, cela signifie que :
- La communication API fonctionne correctement
- Les données sont transformées correctement
- Le rendu frontend est fonctionnel

### Tests Échoués ❌
Si des tests échouent, vérifiez :

1. **Tests Backend** : Problèmes dans `utils/monthlyReport.js`
   - Vérifier les requêtes Supabase
   - Vérifier les calculs de statistiques
   - Vérifier la gestion des erreurs

2. **Tests API** : Problèmes dans `server.js`
   - Vérifier l'endpoint `/api/agents/monthly-report`
   - Vérifier la validation des paramètres
   - Vérifier l'authentification

3. **Tests Frontend** : Problèmes dans `agent-dashboard.html`
   - Vérifier les appels fetch()
   - Vérifier le rendu des données
   - Vérifier la gestion des erreurs

4. **Tests d'Intégration** : Problèmes de communication
   - Vérifier la cohérence des formats de données
   - Vérifier les filtres
   - Vérifier le fallback client-side

## 🐛 Débogage

### Activer les logs détaillés
```bash
# Avec logs Vitest
npm test -- --reporter=verbose
```

### Exécuter un seul fichier de test
```bash
npm test tests/unit/monthlyReport.test.js
```

### Exécuter un seul test
```bash
npm test -- -t "should build a complete monthly report"
```

## 📝 Problèmes Courants Identifiés

Les tests peuvent révéler :

1. **Colonnes manquantes dans Supabase**
   - Erreur : `column "xxx" does not exist`
   - Solution : Vérifier le schéma de la base de données

2. **Paramètres API manquants**
   - Erreur : Tests de validation échouent
   - Solution : Ajouter la validation côté serveur

3. **Transformation de données incorrecte**
   - Erreur : Tests de format échouent
   - Solution : Corriger la logique de transformation

4. **Problèmes de rendu**
   - Erreur : Tests de rendu échouent
   - Solution : Vérifier les fonctions de rendu dans le HTML

## 🔧 Maintenance

### Ajouter de nouveaux tests
1. Créer un fichier `*.test.js` dans le bon dossier
2. Importer les utilitaires nécessaires
3. Écrire les tests avec `describe` et `it`
4. Exécuter `npm test` pour vérifier

### Mettre à jour les fixtures
Modifier `tests/fixtures/monthly-report-data.js` avec de nouvelles données de test

### Mettre à jour les mocks
Modifier `tests/mocks/supabase.js` pour simuler de nouveaux comportements

## 📚 Ressources

- [Documentation Vitest](https://vitest.dev/)
- [Guide des Tests Unitaires](https://vitest.dev/guide/)
- [API Vitest](https://vitest.dev/api/)

## ✅ Checklist de Validation

Avant de déployer :
- [ ] Tous les tests passent (`npm test`)
- [ ] Couverture > 80% (`npm run test:coverage`)
- [ ] Pas de warnings dans les logs
- [ ] Tests d'intégration réussis
- [ ] Documentation à jour
