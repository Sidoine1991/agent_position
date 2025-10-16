# Configuration des Rayons de Tolérance - Presence CCRB

## 📋 Résumé des Configurations

### Méthode de Calcul
- **Formule appliquée** : Rayon de tolérance = Distance déclarée × 0.8 (80%)
- **Marge de sécurité** : 20% de la distance déclarée conservée comme marge
- **Rayon par défaut** : 6 km pour les agents sans déclaration

---

## 🌍 Zone PDA4 (Nord) - 11 Agents

| # | Agent | Commune | CEP | Distance déclarée | Rayon tolérance |
|---|-------|---------|-----|-------------------|-----------------|
| 1 | DJIBRIL ABDEL-HAFIZ | DJOUGOU | 2 | 25 km | **20 km** |
| 2 | GOUKALODE CALIXTE | DASSA-ZOUMÉ | 2 | 22 km | **17.6 km** |
| 3 | EKPA Chabi Ogoudélé Aimé | BASSILA | 2 | 20 km | **16 km** |
| 4 | KALOA Moukimiou | OUAKÉ | 2 | 25 km | **20 km** |
| 5 | CHERIF FABADE DEKANDE LUC | SAVALOU | 2 | 30 km | **24 km** |
| 6 | FADO kami Macaire | BANTÈ | 2 | 15 km | **12 km** |
| 7 | TCHETAN PRUDENCE | GLAZOUE | 2 | 10 km | **8 km** |
| 8 | AKPO ANOS | DASSA ZOUMÈ | 2 | 21 km | **16.8 km** |
| 9 | DAGAN Bruno | Glazoué | 2 | 25 km | **20 km** |
| 10 | ADOHO D. THIBURCE | SAVALOU | 2 | 55 km | **44 km** |
| 11 | SERIKI FATAI | BANTÉ | 2 | 22 km | **17.6 km** |

---

## 🌍 Zone SUD - 4 Agents

| # | Agent | Commune | CEP | Distance déclarée | Rayon tolérance |
|---|-------|---------|-----|-------------------|-----------------|
| 1 | DAGNITO Mariano | Zogbodomey | 2 | 35 km | **28 km** |
| 2 | GOGAN Ida | Zogbodomey | 2 | 35 km | **28 km** |
| 3 | ADJOVI Sabeck | Zogbodomey | 3 | 35 km | **28 km** |
| 4 | TOGNON TCHEGNONSI Bernice | Zogbodomey | 1 | 35 km | **28 km** |

---

## 📊 Statistiques Globales

- **Total agents configurés** : 15
- **Zone PDA4** : 11 agents
- **Zone SUD** : 4 agents
- **Rayon moyen** : 20.1 km
- **Rayon minimum** : 8 km (TCHETAN PRUDENCE)
- **Rayon maximum** : 44 km (ADOHO D. THIBURCE)

---

## 🛠️ Fichiers Créés

### 1. `agent-tolerance-config.js`
- Configuration centralisée des rayons par agent
- Fonctions utilitaires pour récupérer les configurations
- Calcul automatique des rayons (80% de la distance déclarée)

### 2. `agent-tolerance-admin.html`
- Interface d'administration pour gérer les rayons
- Visualisation des configurations par zone
- Filtres et recherche d'agents
- Statistiques globales

### 3. `agent-tolerance-integration.js`
- Intégration avec le système de profil existant
- Fonctions pour appliquer automatiquement les rayons
- Validation des configurations
- Utilitaires de conversion d'unités

### 4. `test-tolerance-config.html`
- Page de test et validation des configurations
- Vérification des calculs
- Tests des fonctions utilitaires
- Interface de test par agent

---

## 🚀 Utilisation

### Pour les Administrateurs
1. Accéder à `/agent-tolerance-admin.html` pour visualiser et gérer les configurations
2. Utiliser `/test-tolerance-config.html` pour valider les paramètres

### Pour les Développeurs
```javascript
// Récupérer le rayon d'un agent
const radius = getAgentToleranceRadius("DJIBRIL ABDEL-HAFIZ"); // Retourne 20000 (mètres)

// Récupérer la configuration complète
const config = getAgentConfig("DJIBRIL ABDEL-HAFIZ");

// Appliquer le rayon personnalisé
const customRadius = applyCustomToleranceRadius("DJIBRIL ABDEL-HAFIZ", 5000);
```

### Intégration dans le Profil
Les rayons personnalisés peuvent être automatiquement appliqués lors du chargement du profil d'un agent en incluant le script `agent-tolerance-integration.js`.

---

## ⚠️ Notes Importantes

1. **Rayon par défaut** : 6 km pour les agents non configurés
2. **Validation** : Tous les rayons sont validés (1-100 km)
3. **Conversion** : Les rayons sont stockés en mètres dans la base de données
4. **Mise à jour** : Les configurations peuvent être modifiées via l'interface d'administration

---

## 🔄 Prochaines Étapes

1. **Intégration API** : Connecter les configurations à l'API backend
2. **Synchronisation** : Mise à jour automatique des profils agents
3. **Monitoring** : Suivi des utilisations des rayons personnalisés
4. **Rapports** : Génération de rapports sur l'efficacité des rayons

---

*Configuration créée le : ${new Date().toLocaleDateString('fr-FR')}*
*Total agents configurés : 15*
