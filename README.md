# 📍 Presence CCRB - Système de Suivi des Agents Terrain

## 🎯 Objectif du Projet

Le système **Presence CCRB** est une solution complète de géolocalisation et de suivi des agents de terrain pour le Centre de Coordination de la Recherche sur le Riz (CCRB). Il permet de vérifier la présence réelle des agents sur leurs zones d'intervention et de générer des rapports de présence fiables.

## 🚀 Fonctionnalités Principales

### 👤 Pour les Agents
- **Application PWA** (Progressive Web App) accessible sur mobile
- **Marquage de présence** avec GPS automatique
- **Prise de photos** comme preuve d'activité
- **Notes d'observation** sur le terrain
- **Sélection de zone** d'intervention (Département → Commune → Arrondissement → Village)
- **Interface intuitive** avec logo CCRB

### 👨‍💼 Pour les Superviseurs/Admins
- **Dashboard en temps réel** avec carte interactive
- **Suivi GPS** des agents avec marqueurs
- **Validation automatique** de présence basée sur la distance GPS
- **Gestion complète des agents** (création, modification, suppression)
- **Page de gestion des agents** (`/admin-agents.html`) avec interface dédiée
- **Exports Excel/CSV** avec validation de présence
- **Rapports mensuels** automatisés
- **Configuration des points de référence** GPS
- **Authentification sécurisée** avec contrôle d'accès par rôle

## 🏗️ Architecture Technique

### Backend (Node.js + Express)
- **Base de données** : SQLite avec `better-sqlite3`
- **Authentification** : JWT (JSON Web Tokens)
- **Validation** : Zod pour les schémas de données
- **Upload de fichiers** : Multer pour les photos
- **Géolocalisation** : Algorithme de Haversine pour calcul de distance

### Frontend
- **PWA Agent** : HTML/CSS/JavaScript vanilla
- **Dashboard** : Interface web avec Leaflet.js pour les cartes
- **Service Worker** : Cache et fonctionnement hors ligne
- **Design responsive** : Compatible mobile et desktop

## 📊 Algorithme de Validation de Présence

### Principe
1. **Point de référence** : Coordonnées GPS du village d'intervention de l'agent
2. **Calcul de distance** : Formule de Haversine pour distance en mètres
3. **Validation automatique** :
   - **Présent** : ≤ 50km du point de référence
   - **Absent** : > 50km du point de référence

### Configuration
- **Rayon de tolérance** : Configurable (50km par défaut)
- **Points de référence** : Basés sur les villages d'intervention
- **Validation en temps réel** : À chaque check-in

## 🗂️ Structure du Projet

```
presence_ccrb/
├── backend/                 # Serveur Node.js
│   ├── src/
│   │   ├── index.ts        # Point d'entrée principal
│   │   ├── routes.ts       # Routes API
│   │   ├── db.ts          # Configuration base de données
│   │   ├── auth.ts        # Authentification JWT
│   │   ├── presence-algorithm.ts  # Algorithme de validation
│   │   └── storage.ts     # Gestion des fichiers
│   ├── data/              # Base de données SQLite
│   └── package.json
├── web/                   # Interface utilisateur
│   ├── index.html         # PWA Agent
│   ├── dashboard.html     # Dashboard Superviseur
│   ├── app.js            # JavaScript Agent
│   ├── dashboard.js      # JavaScript Dashboard
│   ├── styles.css        # Styles CSS
│   └── manifest.webmanifest
├── Media/                # Ressources (logos, images)
├── Data/                 # Données géographiques
│   ├── benin_subdvision.xlsx
│   └── 02_SHP/          # Shapefiles
└── README.md
```

## 🚀 Installation et Démarrage

### Prérequis
- Node.js (version 16+)
- npm ou yarn

### Installation
```bash
# Cloner le projet
git clone <repository-url>
cd presence_ccrb

# Installer les dépendances backend
cd backend
npm install

# Démarrer le serveur
npm run dev
```

### Accès
- **Serveur** : http://localhost:3001
- **PWA Agent** : http://localhost:3001
- **Dashboard** : http://localhost:3001/dashboard.html
- **Gestion des Agents** : http://localhost:3001/admin-agents.html

## 👥 Comptes par Défaut

### Administrateur
- **Email** : `admin@ccrb.local`
- **Mot de passe** : `123456`
- **Rôle** : Admin complet

### Superviseur
- **Email** : `supervisor@ccrb.local`
- **Mot de passe** : `123456`
- **Rôle** : Superviseur

### Agent Test
- **Email** : `agent@test.com`
- **Mot de passe** : `Test@123`
- **Rôle** : Agent

## 📱 Utilisation

### Pour les Agents
1. **Connexion** : Utiliser les identifiants fournis
2. **Sélection de zone** : Choisir Département → Commune → Arrondissement → Village
3. **Marquage présence** : 
   - "Marquer présence (début)" : Début d'activité
   - "Quitter le terrain (fin)" : Fin d'activité
4. **Ajout de notes** : Observations optionnelles
5. **Prise de photos** : Preuve d'activité

### Pour les Superviseurs
1. **Connexion dashboard** : Utiliser compte admin/superviseur
2. **Configuration** : 
   - "🎯 Configurer Points de Référence" : Définir zones d'intervention
   - "➕ Créer/Modifier un Agent" : Gestion des agents
3. **Gestion des agents** : Page dédiée `/admin-agents.html`
   - Création, modification, suppression d'agents
   - Filtrage et recherche d'agents
   - Export des données d'agents
4. **Suivi** : Visualisation temps réel sur carte
5. **Exports** : 
   - "📊 Exporter CSV" : Données brutes
   - "📈 Exporter Excel" : Rapport formaté avec validation

## 📊 Exports et Rapports

### Format Excel/CSV
- **Date et Heure** : Timestamp du check-in
- **Nom Agent** : Identification complète
- **Téléphone** : Contact agent
- **Localisation** : Département/Commune/Arrondissement/Village
- **Coordonnées GPS** : Latitude/Longitude exactes
- **Note** : Observations de l'agent
- **Photo** : Lien vers preuve visuelle
- **Statut Présence** : `present`/`absent`/`Non validé`
- **Distance Référence** : Distance en mètres du point de référence

### Rapports Mensuels
- **Génération automatique** par agent
- **Statistiques** : Jours présents/absents
- **Écarts** : Comparaison avec objectifs
- **Export Excel** : Format standardisé

## 🔧 Configuration Avancée

### Points de Référence GPS
```javascript
// Coordonnées par défaut (Bénin)
const villageCoords = {
  1: { lat: 6.3729, lon: 2.3543 }, // Cotonou
  2: { lat: 6.4969, lon: 2.6036 }, // Porto-Novo
  3: { lat: 7.1861, lon: 1.9911 }, // Abomey
  4: { lat: 9.3077, lon: 2.3158 }, // Parakou
  5: { lat: 6.3600, lon: 2.4200 }, // Ouidah
};
```

### Tolérance de Distance
- **Par défaut** : 50km (50000 mètres)
- **Configurable** : Via dashboard ou API
- **Validation** : Présent ≤ tolérance, Absent > tolérance

## 🛠️ API Endpoints

### Authentification
- `POST /api/auth/login` - Connexion
- `POST /api/auth/register` - Inscription

### Agents
- `GET /api/admin/agents` - Liste des agents (authentifié)
- `GET /api/admin/agents/public` - Liste des agents (public, pour accès libre)
- `POST /api/admin/agents` - Créer un agent
- `PUT /api/admin/agents/:id` - Modifier un agent
- `DELETE /api/admin/agents/:id` - Supprimer un agent

### Présence
- `POST /api/presence/start` - Début de présence
- `POST /api/presence/end` - Fin de présence
- `POST /api/admin/setup-reference-points` - Configurer points de référence

### Exports
- `GET /api/admin/export/checkins.csv` - Export CSV
- `GET /api/admin/export/checkins.xlsx` - Export Excel
- `GET /api/admin/export/monthly-report.csv` - Rapport mensuel

## 🔒 Sécurité

- **Authentification JWT** : Tokens sécurisés (expiration 12h)
- **Validation des rôles** : Admin/Superviseur/Agent
- **Validation des données** : Schémas Zod
- **Upload sécurisé** : Validation des types de fichiers
- **CORS configuré** : Accès contrôlé

## 📱 PWA (Progressive Web App)

### Fonctionnalités
- **Installation** : Ajout à l'écran d'accueil
- **Hors ligne** : Service Worker pour cache
- **Notifications** : Possibilité d'ajout
- **Responsive** : Adaptation mobile/desktop

### Installation
1. Ouvrir l'application dans le navigateur
2. Cliquer sur "Installer" (icône +)
3. L'application sera disponible comme une app native

## 🗄️ Base de Données

### Tables Principales
- **users** : Agents, superviseurs, admins
- **missions** : Sessions d'activité
- **checkins** : Points de présence GPS
- **presence_records** : Validation de présence
- **monthly_reports** : Rapports mensuels
- **departements/communes/arrondissements/villages** : Hiérarchie géographique

### Migration
- **Automatique** : Au démarrage du serveur
- **Compatibilité** : Ajout de colonnes si nécessaire
- **Sauvegarde** : Fichier SQLite dans `backend/data/`

## 🚨 Dépannage

### Erreurs Courantes

#### "Accès non autorisé" sur admin-agents.html
```bash
# Solution : Connectez-vous avec un compte admin/superviseur
# Email: admin@ccrb.local, Mot de passe: 123456
```

#### "Unauthorized" lors de l'export
```bash
# Solution : Reconnectez-vous
localStorage.removeItem('jwt'); location.reload();
```

#### Boutons dashboard ne fonctionnent pas
```bash
# Solution : Rechargez la page
Ctrl + F5
```

#### Modal de suppression ne se ferme pas
```bash
# Solution : Vérifiez la console (F12) pour les erreurs JavaScript
# Ou rechargez la page complètement
```

#### "Point de référence non défini"
```bash
# Solution : Configurez les points de référence
# Dashboard → "🎯 Configurer Points de Référence"
```

### Logs et Debug
- **Console navigateur** : F12 → Console
- **Logs serveur** : Terminal backend
- **Base de données** : Fichier `backend/data/database.db`

## 🔄 Mise à Jour

### Code
```bash
git pull origin main
cd backend
npm install
npm run dev
```

### Cache Navigateur
```bash
# Vider le cache
Ctrl + Shift + R
# Ou
localStorage.clear(); location.reload();
```

## 📞 Support

### Contacts
- **Développeur** : [Votre nom/email]
- **CCRB** : [Contact organisation]
- **Documentation** : Ce README

### Contribution
1. Fork le projet
2. Créer une branche feature
3. Commit les changements
4. Push vers la branche
5. Ouvrir une Pull Request

## 📄 Licence

Ce projet est développé pour le Centre de Coordination de la Recherche sur le Riz (CCRB). Tous droits réservés.

---

## 🎉 Félicitations !

Vous disposez maintenant d'un système complet de suivi de présence des agents avec validation GPS automatique. Le système vous permet de :

✅ **Vérifier la présence réelle** des agents sur le terrain  
✅ **Générer des rapports fiables** avec preuves GPS  
✅ **Exporter les données** en Excel/CSV  
✅ **Suivre en temps réel** l'activité des agents  
✅ **Configurer facilement** les zones d'intervention  
✅ **Gérer complètement les agents** avec interface dédiée  
✅ **Contrôler l'accès** avec authentification sécurisée  

## 🔧 Corrections Récentes

### Version Actuelle
- ✅ **Authentification complète** restaurée sur admin-agents.html
- ✅ **Fonctionnalités CRUD** réactivées (création, modification, suppression)
- ✅ **Export CSV** des données d'agents fonctionnel
- ✅ **Modals de confirmation** corrigés et fonctionnels
- ✅ **Gestionnaires d'événements** robustes pour les boutons
- ✅ **Interface utilisateur** entièrement opérationnelle

### Problèmes Résolus
- 🔧 Modal de suppression ne se fermait pas → **Corrigé**
- 🔧 Boutons "Annuler" non fonctionnels → **Corrigé**
- 🔧 Accès libre désactivé → **Authentification restaurée**
- 🔧 Fonctions d'export désactivées → **Réactivées**

**Bonne utilisation du système Presence CCRB !** 🚀
#   F o r c e   d e p l o y m e n t  
 