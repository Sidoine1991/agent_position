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

## 🏢 Unités Administratives

Le système inclut 10 unités administratives configurables :

1. **Direction Générale** (DG)
2. **Direction des Opérations** (DO)
3. **Direction Administrative et Financière** (DAF)
4. **Service Ressources Humaines** (SRH)
5. **Service Comptabilité** (SC)
6. **Service Logistique** (SL)
7. **Service Sécurité** (SS)
8. **Service Informatique** (SI)
9. **Service Communication** (SCOM)
10. **Service Juridique** (SJ)

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
- **Développeur** : [Votre nom/email]
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