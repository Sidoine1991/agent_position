# Presence CCRB – Suivi de Présence Terrain

Application de suivi de présence des agents sur le terrain avec carte interactive (Leaflet), back-end Node/Express + PostgreSQL, et déploiements Render/Vercel.

## Rôles et accès
- Admin: accès global, paramètres, exports, rapports.
- Superviseur: accès aux données agents (lecture), exports.
- Agent: marquage présence (démarrer/finir), check-ins, profil.

Auth JWT (24h). Middleware serveur: `requireAuth(roles?: ['admin'|'superviseur'|'agent'])`.

## Environnements
- Front (Vercel): `https://agent-position.vercel.app`
- API (Render): `https://presence-ccrb-v2.onrender.com`

Variables d’environnement (Render / local):
- `DATABASE_URL`: Postgres
- `JWT_SECRET`: secret JWT (obligatoire en prod)
- `PUBLIC_BASE_URL`: URL publique de l’API (ex: Render)
- `SERPAPI_KEY`: optionnel (proxy `/api/geo/search`)
- `EMAIL_USER`, `EMAIL_PASS`: (optionnel) envoi d’emails

## Flux d’utilisation (agent)
1. Ouvrir la carte. Chercher un lieu et cliquer ⇒ la carte centre, un marqueur “Départ” est posé, la position manuelle est mémorisée.
2. Démarrer Mission ⇒ `/api/presence/start` avec lat/lon (GPS ou position corrigée).
3. Check-in ponctuels ⇒ `/api/mission/checkin` (facultatif).
4. Finir Mission ⇒ `/api/presence/end` (ou bouton de secours sans GPS ⇒ `/api/presence/force-end`).

La carte publique affiche aussi les points publics (check-ins + départ/fin) sans authentification.

## Contrats API (normalisés)
Toutes les réponses suivent `{ success: boolean, data?: any, error?: string }`.

### Auth & Profil
- `GET /api/me` (JWT): `{ data: { user } }`
- `GET /api/profile?email=`: `{ data: { user } }`

### Missions / Présence (JWT)
- `POST /api/presence/start` body `{lat,lon, ...}` → `{ data: { message, mission_id, distance_from_reference_m } }`
- `POST /api/presence/end` body `{ mission_id?, lat?, lon?, note? }` → `{ data: { message, force_end? } }`
- `POST /api/presence/force-end` body `{ mission_id?, note? }` → `{ data: { message, force_end: true } }`
- `GET /api/me/missions` → `{ data: { missions: Mission[] } }`
- `GET /api/missions/:id/checkins` → `{ data: { checkins: Checkin[] } }`

### Admin/Superviseur (JWT)
- `GET /api/admin/checkins?from&to&agent_id&limit&offset` → `{ data: { items, limit, offset } }` (items avec `type: 'checkin'|'mission_start'|'mission_end'`)
- `GET /api/admin/checkins/latest?limit&offset` → `{ data: { items, limit, offset } }`
- `GET /api/admin/agents` → (à normaliser si besoin) liste agents

### Public
- `GET /api/public/checkins/latest?limit` → `{ data: { checkins } }`

### Paramètres
- `GET /api/settings` → `{ data: { settings } }`

## Données & Index
Tables: `users`, `missions`, `checkins`, `reports`, `absences`, `app_settings`.

Index recommandés: `missions(user_id,start_time)`, `checkins(mission_id,timestamp)`, `users(email)`. Contraintes: `role` CHECK, FKs.

## Sécurité
- `helmet` activé, CORS origin strict, `express-rate-limit` global (300 req/15min).
- JWT vérifié via `requireAuth`. Valider inputs (coords, email, ids).

## UI/UX
- Carte: recherche (Nominatim/SerpApi), correction GPS manuelle, barre de statut compacte, marqueurs colorés par agent, types de points distincts.
- Dashboard admin: couleurs uniques par agent, timeline, export CSV/TXT.

## Déploiement
- Render: API Node/Express (variables env + Postgres). Vercel: front statique.
- Cache busting via query `?v=` sur assets (géré dans le code).

## Tests rapides
- `GET /api/health` (disponible)
- Auth: POST `/api/login` → stocker `jwt` dans localStorage
- `GET /api/me` doit renvoyer l’utilisateur

## Roadmap rapide
- Validation d’inputs complète (zod/express-validator)
- Aggrégats périodiques (vue matérialisée/table) pour KPI hebdo/mensuel
- Légende/filtres supplémentaires sur la carte (par type de point)

---
Pour tout besoin (correctifs/évolutions), ouvrir une issue avec le contexte, la route concernée et les logs.
# 📍 Presence CCRB - Système de Suivi des Agents Terrain

## 🎯 À Propos

Le système **Presence CCRB** est une solution complète de géolocalisation et de suivi des agents de terrain pour le **Conseil de Concertation des Riziculteurs du Bénin (CCRB)**. Il permet de vérifier la présence réelle des agents sur leurs zones d'intervention et de générer des rapports de présence fiables.

## 🚀 Fonctionnalités Principales

### 👤 Pour les Agents
- **Application PWA** (Progressive Web App) accessible sur mobile
- **Marquage de présence** avec GPS automatique
- **Prise de photos** comme preuve d'activité
- **Notes d'observation** sur le terrain
- **Sélection de zone** d'intervention (Département → Commune → Arrondissement → Village)
- **Interface intuitive** avec logo CCRB
- **Calendrier de présence** avec historique
- **Tableau de bord** avec métriques personnelles

### 👨‍💼 Pour les Superviseurs/Admins
- **Dashboard en temps réel** avec carte interactive
- **Suivi GPS** des agents avec marqueurs
- **Validation automatique** de présence basée sur la distance GPS
- **Gestion complète des agents** (création, modification, suppression)
- **Unités administratives** configurables
- **Exports Excel/CSV** avec validation de présence
- **Rapports mensuels** automatisés
- **Configuration des points de référence** GPS
- **Authentification sécurisée** avec contrôle d'accès par rôle

## 🏗️ Architecture Technique

### Backend (Vercel Serverless)
- **API consolidée** : Un seul fichier `api/index.js`
- **Stockage en mémoire** : Données temporaires pour déploiement serverless
- **Authentification** : JWT avec secret sécurisé
- **CORS configuré** : Accès cross-origin
- **Géolocalisation** : Algorithme de validation de présence

### Frontend
- **PWA Agent** : HTML/CSS/JavaScript vanilla
- **Dashboard** : Interface web responsive
- **Service Worker** : Cache et fonctionnement hors ligne
- **Design responsive** : Compatible mobile et desktop
- **Vercel Analytics** : Suivi des performances

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
├── api/                      # API Serverless Vercel
│   ├── index.js             # API consolidée
│   └── package.json         # Dépendances API
├── web/                     # Interface utilisateur
│   ├── index.html           # PWA Agent
│   ├── dashboard.html       # Dashboard Superviseur
│   ├── agents.html          # Gestion des agents
│   ├── profile.html         # Profil utilisateur
│   ├── reports.html         # Rapports
│   ├── admin.html           # Administration
│   ├── app.js              # JavaScript Agent
│   ├── dashboard.js        # JavaScript Dashboard
│   ├── agents.js           # JavaScript Gestion agents
│   ├── profile.js          # JavaScript Profil
│   ├── reports.js          # JavaScript Rapports
│   ├── admin.js            # JavaScript Admin
│   ├── styles.css          # Styles CSS
│   ├── manifest.webmanifest # PWA Manifest
│   └── Media/              # Ressources
│       ├── PP CCRB.png     # Logo CCRB
│       ├── default-avatar.png
│       └── default-avatar.svg
├── Media/                   # Ressources globales
│   └── PP CCRB.png         # Logo principal
├── package.json            # Configuration principale
├── vercel.json            # Configuration Vercel
├── .vercelignore          # Fichiers ignorés par Vercel
└── README.md              # Documentation
```

## 🚀 Déploiement

### Vercel (Recommandé)
Le projet est configuré pour un déploiement automatique sur Vercel :

1. **Connectez le repository GitHub** à Vercel
2. **Déploiement automatique** à chaque push
3. **URL de production** : https://agent-position.vercel.app/

### Configuration Vercel
- **Framework** : Other
- **Root Directory** : `/`
- **Build Command** : (automatique)
- **Output Directory** : (automatique)

## 👥 Comptes par Défaut

### Administrateur
- **Email** : `admin@ccrb.local`
- **Mot de passe** : `123456`
- **Rôle** : Admin complet
- **Unité** : Direction Générale

### Superviseur
- **Email** : `supervisor@ccrb.local`
- **Mot de passe** : `123456`
- **Rôle** : Superviseur
- **Unité** : Direction des Opérations

## 📱 Utilisation

### Pour les Agents
1. **Connexion** : Utiliser les identifiants fournis
2. **Sélection de zone** : Choisir Département → Commune → Arrondissement → Village
3. **Marquage présence** : 
   - "Marquer présence (début)" : Début d'activité
   - "Quitter le terrain (fin)" : Fin d'activité
4. **Ajout de notes** : Observations optionnelles
5. **Prise de photos** : Preuve d'activité
6. **Consultation calendrier** : Historique de présence

### Pour les Superviseurs
1. **Connexion dashboard** : Utiliser compte admin/superviseur
2. **Gestion des agents** : Page `/agents.html`
   - Création, modification, suppression d'agents
   - Attribution d'unités administratives
   - Filtrage et recherche d'agents
   - Export des données d'agents
3. **Suivi** : Visualisation temps réel sur dashboard
4. **Rapports** : Génération et export de rapports

### Pour les Administrateurs
1. **Administration** : Page `/admin.html`
   - Gestion des unités administratives
   - Configuration système
   - Maintenance
2. **Gestion complète** : Tous les droits superviseur + admin

## 🧭 Flux Fonctionnel Complet (Flowchart)

```text
[Agent]                                        [API]                                      [Admin/Superviseur]
   |                                              |                                                 |
   | 1) Inscription (agent) --------------------> | POST /api/register  --------------------------> |
   |    - Saisit nom, email, mot de passe         | 201 { token, user }                             |
   |    - (Option) OTP email pour validation      | (OTP/validation à brancher)                    |
   v                                              v                                                 |
  Connexion (agent) ----------------------------> | POST /api/login -> 200 { success, token, user } |
   |  Stocke le JWT (localStorage)                |                                                 |
   v                                              |                                                 |
  Sélection zone (Dépt->Com->Arr->Vill)           |                                                 |
   |                                              |                                                 |
  2) Début de mission (Marquer présence) -------> | POST /api/presence/start -> 200 {mission_id}   |
   |  - GPS auto + (photo facultative)            |  (Crée mission active + 1er check-in)          |
   v                                              |                                                 v
  3) Check-in(s) terrain -----------------------> | POST /api/mission/checkin -> 200                |
   |  - GPS + note/ photo                         |  (Ajoute un point de présence)                 |
   v                                              |                                                 |
  4) Fin de mission ---------------------------> | POST /api/presence/end -> 200                   |
   |  - GPS + note/ photo                         |  (Ajoute un point + clôture mission)           |
   v                                              v                                                 v
  Profil/Stats (agent) <------------------------ | GET /api/me/missions (historique)               |
                                                 | GET /api/profile                                |
                                                 | GET /api/admin/checkins/latest (carte) --------> 5) Dashboard
                                                 | GET /api/admin/checkins (filtres)               |   - Markers Leaflet en temps réel
                                                 | POST /api/admin/setup-reference-points --------> |   - Liste agents & filtres
                                                 | POST /api/admin/generate-monthly-report -------> |   - Historique mensuel
                                                 | GET /api/admin/export/checkins.csv ------------> | 6) Export CSV/TXT mensuel
                                                 | GET /api/admin/export/checkins.txt ------------> |
```

### Étapes clés détaillées
- **Inscription**
  - L’agent peut s’auto-inscrire (ou être créé par l’administrateur). Un flux OTP email peut être branché pour activer le compte avant la première connexion.
- **Connexion**
  - Réception d’un JWT et stockage local. Les pages utilisent `/api/profile` (ou `/api/profile?email=` en mode soft-auth) pour charger le profil en production.
- **Marquage de présence**
  - Début: `/api/presence/start` crée une mission active et enregistre un point (lat/lon, note, photo).
  - Check-in: `/api/mission/checkin` ajoute des points intermédiaires.
  - Fin: `/api/presence/end` clôture la mission et enregistre un point final.
  - Hors-ligne: les envois sont mis en file (Background Sync) et envoyés au retour réseau.
- **Supervision**
  - Carte Leaflet avec markers issus de `/api/admin/checkins/latest` (derniers points) et `/api/admin/checkins` (filtres).
  - Configuration des points de référence (rayon, coordonnées) via `/api/admin/setup-reference-points`.
- **Rapports & Exports**
  - Génération de rapport mensuel (stub) et export CSV/TXT via `/api/admin/export/*`.

## 🔁 Cas d’usage – de bout en bout
- Un administrateur crée un agent (ou l’agent s’inscrit). L’agent reçoit (optionnellement) un OTP et active son compte.
- L’agent se connecte, choisit sa zone d’intervention et débute une mission; le GPS enregistre sa présence.
- L’agent peut ajouter des check-ins (photos/notes). En fin de journée, il clôture sa mission.
- Le superviseur visualise en temps réel les points sur la carte (Leaflet) et filtre par date/agent/zone.
- En fin de mois, l’administrateur exporte la liste de présence en CSV/TXT depuis le dashboard.

## 🧪 Endpoints Clés (résumé)
- Auth: `POST /api/login`, `POST /api/register`, `GET /api/profile`
- Missions & présence: `POST /api/presence/start`, `POST /api/mission/checkin`, `POST /api/presence/end`, `GET /api/me/missions`
- Supervision: `GET /api/admin/checkins/latest`, `GET /api/admin/checkins`, `GET /api/admin/agents`
- Référence & rapports: `POST /api/admin/setup-reference-points`, `POST /api/admin/generate-monthly-report`, `GET /api/admin/export/checkins.csv`, `GET /api/admin/export/checkins.txt`, `GET /api/admin/export/monthly-report.csv`

## 🏢 Unités Administratives

Les unités administratives correspondent à la hiérarchie géographique d'intervention : **Département → Commune → Arrondissement → Village**. Chaque animateur dispose d'un point de référence (au niveau du village) et marque sa présence lorsqu'il se rend travailler dans cette zone.

## 🛠️ API Endpoints

### Authentification
- `POST /api/login` - Connexion
- `POST /api/register` - Inscription
- `GET /api/profile` - Profil utilisateur

### Agents
- `GET /api/users` - Liste des agents (authentifié)
- `POST /api/users` - Créer un agent
- `PUT /api/users/:id` - Modifier un agent
- `DELETE /api/users/:id` - Supprimer un agent

### Unités Administratives
- `GET /api/admin-units` - Liste des unités administratives

### Utilitaires
- `GET /api/health` - Santé de l'API
- `GET /api/test` - Test de l'API

## 🔒 Sécurité

- **Authentification JWT** : Tokens sécurisés avec secret de 128 caractères
- **Validation des rôles** : Admin/Superviseur/Agent
- **CORS configuré** : Accès contrôlé
- **Stockage sécurisé** : Données en mémoire pour serverless

## 📱 PWA (Progressive Web App)

### Fonctionnalités
- **Installation** : Ajout à l'écran d'accueil
- **Hors ligne** : Service Worker pour cache
- **Notifications** : Possibilité d'ajout
- **Responsive** : Adaptation mobile/desktop
- **Manifest** : Configuration PWA complète

### Installation
1. Ouvrir l'application dans le navigateur
2. Cliquer sur "Installer" (icône +)
3. L'application sera disponible comme une app native

## 🚨 Dépannage

### Erreurs Courantes

#### "Accès non autorisé"
```bash
# Solution : Connectez-vous avec un compte admin/superviseur
# Email: admin@ccrb.local, Mot de passe: 123456
```

#### "Session invalide"
```bash
# Solution : Reconnectez-vous
localStorage.removeItem('jwt'); location.reload();
```

#### API non disponible
```bash
# Solution : Vérifiez le déploiement Vercel
# Attendez 2-3 minutes après un push
```

### Logs et Debug
- **Console navigateur** : F12 → Console
- **Vercel Logs** : Dashboard Vercel → Functions → Logs
- **Network** : F12 → Network pour voir les appels API

## 🔄 Mise à Jour

### Code
```bash
git pull origin main
git push  # Déclenche le redéploiement automatique
```

### Cache Navigateur
```bash
# Vider le cache
Ctrl + Shift + R
# Ou
localStorage.clear(); location.reload();
```

## 📊 Fonctionnalités Avancées

### Tableau de Bord
- **Métriques en temps réel** : Jours travaillés, heures, taux de présence
- **Position actuelle** : Géolocalisation en direct
- **Calendrier interactif** : Historique de présence
- **Notifications** : Rappels et alertes

### Rapports
- **Génération automatique** : Rapports mensuels par agent
- **Export Excel/CSV** : Données formatées
- **Statistiques** : Taux de présence, écarts
- **Graphiques** : Visualisation des données

### Administration
- **Gestion des unités** : Configuration des unités administratives
- **Paramètres système** : Configuration globale
- **Maintenance** : Outils d'administration
- **Sauvegarde** : Export des données

## 📞 Support

### Contacts
- **Développeur** : Sidoine Kolaolé YEBADOKPO — conseil.riziculteurs.benin2006@gmail.com — +229 0196911346 / +229 0164052710
- **CCRB** : Conseil de Concertation des Riziculteurs du Bénin
- **Documentation** : Ce README

### Contribution
1. Fork le projet
2. Créer une branche feature
3. Commit les changements
4. Push vers la branche
5. Ouvrir une Pull Request

## 📄 Licence

Ce projet est développé pour le **Conseil de Concertation des Riziculteurs du Bénin (CCRB)**. Tous droits réservés.

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
✅ **Organiser par unités administratives**  
✅ **Déployer facilement** sur Vercel  

## 🔧 Version Actuelle

### Fonctionnalités Implémentées
- ✅ **API consolidée** avec JWT sécurisé
- ✅ **Unités administratives** configurables
- ✅ **Gestion complète des agents** avec formulaire
- ✅ **Interface responsive** et moderne
- ✅ **PWA fonctionnelle** avec service worker
- ✅ **Déploiement Vercel** automatique
- ✅ **Authentification robuste** par rôles
- ✅ **Calendrier de présence** interactif
- ✅ **Tableau de bord** avec métriques

**Bonne utilisation du système Presence CCRB !** 🚀