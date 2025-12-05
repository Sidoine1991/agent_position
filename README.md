# 📍 Presence CCRB - Solution de Gestion de Présence

## 🎯 Présentation

**Presence CCRB** est une solution complète de gestion de présence géolocalisée développée pour le **Conseil de Concertation des Riziculteurs du Bénin (CCRB)**. Cette application web progressive (PWA) permet un suivi précis et fiable des déplacements des agents sur le terrain.

### 🎯 Objectifs
- Assurer le suivi en temps réel des agents sur le terrain
- Vérifier la présence effective dans les zones d'intervention
- Générer des rapports détaillés avec preuves géolocalisées
- Faciliter la communication entre les différents acteurs
- Optimiser la gestion des ressources humaines

### 🌍 Contexte
Développée pour répondre aux besoins spécifiques du secteur agricole béninois, l'application s'adapte aux contraintes de connectivité des zones rurales tout en offrant une expérience utilisateur moderne et intuitive.

![Page d'accueil de l'application](Media/screenshot_app/page_acceuil.png)

## 🚀 Fonctionnalités Clés

### 🎯 Gestion des Présences
- **Marquage de présence** géolocalisé avec preuves photo
- **Suivi en temps réel** des déplacements
- **Validation des présences** par les superviseurs
- **Historique complet** avec horodatage et localisation
- **Gestion des absences** avec enregistrement automatique
- **Jours permissionnaires** avec suivi des congés et autorisations

### 📝 Suivi d'Activité Agent
- **Suivi détaillé des activités** quotidiennes des agents
- **Tableau d'évaluation** avec filtres avancés (projet, agent, superviseur, statut)
- **Statistiques par agent** : activités réalisées, en cours, non réalisées
- **Suivi de suivi** avec vue consolidée par projet et par agent
- **Gestion des résultats** : réalisé, partiellement réalisé, non réalisé, en cours
- **Filtrage multi-critères** pour une analyse précise
- **Export des données** d'activité pour reporting

### 💬 Système de Messagerie
- **Messagerie interne** en temps réel entre agents, superviseurs et administrateurs
- **Notifications** sonores et visuelles pour les nouveaux messages
- **Historique des conversations** avec recherche
- **Envoi de messages** individuels et de groupe
- **Indicateurs de lecture** et statuts de livraison
- **Interface intuitive** avec navigation circulaire

### 📊 Tableaux de Bord
- **Vue d'ensemble** des activités en cours
- **Statistiques** de présence et de productivité
- **Cartographie** des interventions
- **Alertes** en temps réel
- **Classement des agents** par performance
- **Synthèse mensuelle** avec indicateurs clés
- **Tableau de bord agent** personnalisé avec statistiques individuelles
- **Tableau de bord superviseur** avec vue d'équipe

### 🌍 Synthèse Globale
- **Vue consolidée** de tous les projets et agents
- **Indicateurs clés de performance** (KPI) globaux
- **Analyse comparative** entre projets et périodes
- **Tendances** et évolutions sur plusieurs mois
- **Cartographie globale** des interventions
- **Rapports synthétiques** par département, commune, arrondissement

### 📑 Rapports Enrichis
- **Rapports détaillés** avec graphiques et visualisations
- **Export multi-formats** : PDF, Excel, CSV
- **Filtres avancés** : période, agent, projet, statut
- **Rapports personnalisables** selon les besoins
- **Analyses statistiques** approfondies
- **Comparaisons** entre périodes et agents

### 📈 Analytics et Insights
- **Analyses prédictives** basées sur les données historiques
- **Détection de tendances** et anomalies
- **Tableaux de bord analytiques** interactifs
- **Métriques de performance** avancées
- **Visualisations** de données (graphiques, cartes, tableaux)

### 🗓️ Planification Avancée
- **Planification des activités** par agent et par projet
- **Calendrier interactif** avec vue mensuelle, hebdomadaire et quotidienne
- **Gestion des permissions** et jours de congé
- **Affectation des missions** avec validation
- **Suivi de la réalisation** des activités planifiées
- **Alertes** pour les activités non réalisées

### 📋 Résumé de Projet
- **Vue détaillée par projet** avec statistiques spécifiques
- **Liste des agents** affectés au projet
- **Activités du projet** avec statuts et résultats
- **Indicateurs de performance** par projet
- **Historique** des activités du projet

### 🔄 Synchronisation et Performance
- **Mode hors-ligne** avec synchronisation automatique
- **Multi-appareils** (mobile et web)
- **Export des données** (PDF, Excel, CSV)
- **API** pour intégration avec d'autres systèmes
- **Optimisation des performances** avec mise en cache intelligente
- **Synchronisation différentielle** pour économiser la bande passante
- **Service Worker** pour fonctionnement offline

## 🛠️ Installation et Configuration

### Prérequis
- Node.js 16+ et npm
- Compte Supabase
- Accès administrateur au serveur

### Configuration
1. **Cloner le dépôt**
   ```bash
   git clone https://github.com/votre-utilisateur/presence-ccrb.git
   cd presence-ccrb
   ```

2. **Installer les dépendances**
   ```bash
   npm install
   ```

3. **Configurer les variables d'environnement**
   Créez un fichier `.env` à la racine du projet :
   ```env
   SUPABASE_URL=votre_url_supabase
   SUPABASE_ANON_KEY=votre_cle_anonyme
   JWT_SECRET=votre_secret_jwt
   NODE_ENV=development
   ```

4. **Lancer l'application**
   ```bash
   npm start
   ```

## 🔧 Déploiement

### Sur Vercel
[![Déployer avec Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvotre-utilisateur%2Fpresence-ccrb)

### Manuellement
1. Construisez l'application :
   ```bash
   npm run build
   ```
2. Déployez le contenu du dossier `dist` sur votre serveur web.

## 👥 Rôles et Permissions

### 🔹 Agents de Terrain
- **Marquage de présence** avec géolocalisation
- **Gestion des missions** quotidiennes
- **Saisie de rapports** et observations
- **Consultation** de l'historique et du planning
- **Demande de permissions** et suivi des congés
- **Tableau de bord personnel** avec statistiques
- **Suivi d'activité** avec saisie des résultats de journée
- **Messagerie** pour communiquer avec l'équipe
- **Planification** des activités à venir

### 🔹 Superviseurs
- **Suivi en temps réel** des équipes
- **Validation** des présences et permissions
- **Gestion des plannings** et affectations
- **Génération de rapports** d'activité
- **Tableaux de bord** par équipe et par projet
- **Alertes** sur les écarts de présence
- **Suivi d'activité** détaillé avec filtres avancés
- **Messagerie** pour coordonner les équipes
- **Synthèse globale** pour vue d'ensemble
- **Analytics** pour analyses approfondies

### Administrateurs
- **Configuration** du système
- **Gestion des utilisateurs** et des droits
- **Supervision** des données
- **Maintenance** de l'application
- **Accès complet** à tous les tableaux de bord et rapports
- **Gestion des projets** et affectations
- **Configuration avancée** des paramètres système
- **Analytics** et insights complets

## Documentation Technique

### Architecture
- **Frontend** : React.js avec Material-UI
- **Backend** : Node.js avec Express
- **Base de données** : PostgreSQL via Supabase
- **Authentification** : JWT avec renouvellement automatique
- **Gestion des états** : Redux pour une expérience utilisateur fluide
- **Géolocalisation** : Intégration avec les APIs natives du navigateur

### API REST
Les endpoints principaux sont :

#### Authentification
- `POST /api/auth/login` - Authentification
- `POST /api/auth/register` - Inscription
- `POST /api/auth/logout` - Déconnexion
- `GET /api/auth/me` - Informations utilisateur actuel

#### Présence
- `GET /api/presence` - Récupérer les présences
- `POST /api/presence` - Enregistrer une présence
- `POST /api/presence/mark-absent` - Marquer une absence
- `GET /api/presence/check-today` - Vérifier la présence du jour
- `GET /api/presence/agent/:id` - Présences d'un agent spécifique

#### Activités
- `GET /api/activities` - Récupérer les activités
- `POST /api/activities` - Créer une activité
- `PUT /api/activities/:id` - Mettre à jour une activité
- `DELETE /api/activities/:id` - Supprimer une activité
- `GET /api/activities/stats` - Statistiques d'activités

#### Rapports et Analytics
- `GET /api/reports` - Générer des rapports
- `GET /api/reports/daily` - Rapport quotidien
- `GET /api/reports/weekly` - Rapport hebdomadaire
- `GET /api/reports/monthly` - Rapport mensuel
- `GET /api/analytics/presence` - Analytics de présence
- `GET /api/analytics/missions` - Analytics de missions
- `GET /api/analytics/performance` - Analytics de performance

#### Permissions
- `GET /api/permission-days` - Gérer les jours de permission
- `POST /api/permission-days` - Créer une demande de permission
- `PUT /api/permission-days/:id` - Mettre à jour une permission

#### Messagerie
- `GET /api/messages` - Récupérer les messages
- `POST /api/messages` - Envoyer un message
- `GET /api/messages/conversations` - Liste des conversations
- `PUT /api/messages/:id/read` - Marquer un message comme lu

#### Utilisateurs et Agents
- `GET /api/agents` - Liste des agents
- `POST /api/agents` - Créer un agent
- `PUT /api/agents/:id` - Mettre à jour un agent
- `DELETE /api/agents/:id` - Supprimer un agent
- `GET /api/projects` - Liste des projets

### Variables d'environnement
| Variable | Description |
|----------|-------------|
| `PORT` | Port d'écoute du serveur |
| `NODE_ENV` | Environnement (development/production) |
| `SUPABASE_URL` | URL de l'API Supabase |
| `SUPABASE_ANON_KEY` | Clé d'API publique Supabase |
| `JWT_SECRET` | Secret pour la signature des tokens JWT |

## 📱 Comment accéder au système ?

### Sur Mobile (Recommandé pour les agents)
1. Ouvrez votre navigateur (Chrome, Firefox, Safari)
2. Allez à l'adresse : `https://presence-ccrb-v2.onrender.com`
3. L'application s'installe automatiquement comme une app
4. Activez les notifications pour les rappels de présence

### Sur Ordinateur (Pour superviseurs et admins)
1. Ouvrez votre navigateur
2. Allez à l'adresse : `https://presence-ccrb-v2.onrender.com`
3. Utilisez l'interface web complète
4. Accédez aux tableaux de bord avancés

## 📧 Configuration des Emails

### Paramètres SMTP
Configurez ces variables pour activer les notifications par email :

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=votre-email@ccrb.bj
SMTP_PASS=votre-mot-de-passe
EMAIL_FROM=ne-pas-repondre@ccrb.bj
```

### Types d'emails envoyés
- **Inscription** : Bienvenue et activation du compte
- **Réinitialisation de mot de passe**
- **Notifications importantes**
- **Rapports hebdomadaires**

### Dépannage
Si les emails ne sont pas reçus :
1. Vérifiez le dossier spam
2. Vérifiez les logs du serveur
3. Testez la configuration avec un outil comme [Mailtrap](https://mailtrap.io/)

## 🔐 Sécurité

### Authentification
- Connexion sécurisée avec JWT
- Expiration des sessions
- Protection contre les attaques par force brute
- Validation des entrées utilisateur

### Protection des données
- Chiffrement des données sensibles (AES-256)
- Sauvegardes automatiques et redondantes
- Journalisation détaillée des accès et modifications
- Conformité RGPD et protection de la vie privée
- Gestion des consentements utilisateurs
- Audit de sécurité régulier

### Bonnes pratiques
- Utilisez des mots de passe complexes
- Activez l'authentification à deux facteurs
- Ne partagez pas vos identifiants
- Signalez toute activité suspecte

## 🆕 Dernières Mises à Jour

### Décembre 2024
- **Nouveau module de suivi d'activité** avec tableau d'évaluation complet
- **Système de messagerie interne** en temps réel
- **Synthèse globale** avec vue consolidée de tous les projets
- **Rapports enrichis** avec visualisations avancées
- **Analytics et insights** pour analyses prédictives
- **Résumé de projet** avec statistiques détaillées
- **Planification avancée** avec calendrier interactif
- **Navigation circulaire** améliorée pour une meilleure UX
- **Corrections de bugs** et optimisations de performance

### Novembre 2024
- **Nouveau système de rapports mensuels** avec indicateurs clés
- **Gestion des permissions et absences** améliorée
- **Optimisation des performances** pour les connexions lentes
- **Interface utilisateur** revue et améliorée
- **Synchronisation** plus fiable en mode hors ligne
- **Sécurité** renforcée avec authentification à deux facteurs

### Octobre 2024
- Intégration avec les services de cartographie
- Amélioration de la gestion des photos de présence
- Optimisation pour les réseaux mobiles

## 🤝 Contribution

### Développement
1. Forkez le dépôt
2. Créez une branche pour votre fonctionnalité
3. Soumettez une pull request avec une description détaillée

### Signalement de bugs
Ouvrez une issue sur GitHub avec :
- Description du problème
- Étapes pour reproduire
- Comportement attendu
- Captures d'écran si possible

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 🙋 Support

Pour toute question ou assistance :
- Email : support@ccrb.bj
- Téléphone : +229 XX XX XX XX
- Heures d'ouverture : Lun-Ven, 8h-17h (GMT+1)

## 🌐 Liens utiles
- [Documentation technique](https://docs.ccrb.bj/presence)
- [Portail d'assistance](https://support.ccrb.bj)
- [Télécharger l'APK](https://ccrb.bj/downloads/presence-ccrb.apk)
1. Cliquez sur "Se connecter"
2. Entrez votre email et mot de passe
3. Cliquez sur "Connexion"
4. Vous arrivez sur votre tableau de bord

<!-- Illustration connexion volontairement supprimée pour rester à 3 screenshots clés -->

## 📋 Guide d'utilisation par rôle

### 👤 Pour les AGENTS

#### 1. Se connecter
- Utilisez vos identifiants fournis par votre superviseur
- L'application se souvient de votre connexion

#### 2. Communiquer avec l'équipe
- Allez dans **"Messages"** pour accéder à la messagerie
- **Sélectionnez un contact** dans la liste pour démarrer une conversation
- **Envoyez des messages** pour coordonner vos activités
- **Consultez l'historique** de vos conversations
- Recevez des **notifications** sonores et visuelles pour les nouveaux messages
- **Indicateurs de lecture** pour savoir si vos messages ont été lus

#### 3. Suivre vos activités
- Allez dans **"Suivi Activité"** pour accéder au module de suivi
- **Consultez vos activités** planifiées et réalisées
- **Saisissez les résultats** de vos journées (réalisé, partiellement réalisé, non réalisé)
- **Filtrez par projet** ou par période pour une vue ciblée
- **Consultez vos statistiques** personnelles d'activité

#### 4. Choisir votre zone d'intervention
- **Département** : Sélectionnez votre département
- **Commune** : Choisissez votre commune
- **Arrondissement** : Sélectionnez l'arrondissement
- **Village** : Choisissez le village où vous travaillez

#### 5. Marquer votre présence

##### Début de journée
1. Cliquez sur **"Marquer présence (début)"**
2. L'application utilise votre GPS automatiquement
3. Ajoutez une photo si nécessaire
4. Écrivez une note sur vos activités prévues
5. Cliquez sur **"Confirmer"**

##### Pendant la journée (optionnel)
1. Cliquez sur **"Check-in"** pour marquer un point
2. Ajoutez une photo de votre activité
3. Notez vos observations
4. Cliquez sur **"Enregistrer"**

##### Fin de journée
1. Cliquez sur **"Quitter le terrain (fin)"**
2. L'application enregistre votre position finale
3. Ajoutez un résumé de votre journée
4. Cliquez sur **"Confirmer"**

#### 6. Consulter votre historique
- Allez dans **"Profil"** pour voir vos statistiques
- Consultez le **calendrier** pour voir vos jours de présence
- Vérifiez vos **missions** dans l'historique

<!-- Illustrations agents (calendrier/historique/profil) retirées pour rester concis -->

### 👨‍💼 Pour les SUPERVISEURS

#### 1. Accéder au tableau de bord
- Connectez-vous avec un compte superviseur
- Vous voyez la carte avec tous les agents

![Tableau de bord superviseur](Media/screenshot_app/tabmleau_bord.png)

#### 2. Communiquer avec les agents
- Utilisez la **messagerie interne** pour contacter vos agents
- **Envoyez des instructions** ou demandez des rapports
- **Suivez les conversations** avec chaque agent
- **Coordonnez les activités** de terrain en temps réel

#### 3. Gérer les agents
- Allez dans **"Agents"**
- **Créer un agent** : Cliquez sur "Nouvel Agent"
- **Modifier un agent** : Cliquez sur l'icône crayon
- **Supprimer un agent** : Cliquez sur l'icône poubelle
- **Voir les détails** : Cliquez sur l'icône œil

<!-- Illustration planification retirée pour rester à 3 screenshots -->

#### 4. Suivre les agents en temps réel
- La **carte** montre les positions des agents
- Les **marqueurs colorés** indiquent les différents agents
- **Filtrez par date** pour voir l'historique

#### 5. Suivre les activités des agents
- Allez dans **"Suivi Activité"**
- **Filtrez par projet**, agent, superviseur ou statut
- **Consultez les statistiques** détaillées par agent
- **Visualisez les activités** réalisées, en cours et non réalisées
- **Exportez les données** pour analyse approfondie

#### 6. Générer des rapports
- Allez dans **"Rapports"**
- Choisissez la **période** (aujourd'hui, cette semaine, ce mois)
- Sélectionnez un **agent** ou tous les agents
- Cliquez sur **"Générer le rapport"**
- **Exportez** en Excel ou PDF
- **Rapports enrichis** avec graphiques et visualisations

#### 7. Consulter la synthèse globale
- Allez dans **"Synthèse Globale"**
- **Vue d'ensemble** de tous les projets et agents
- **Indicateurs clés** de performance globaux
- **Analyses comparatives** entre périodes
- **Cartographie globale** des interventions

![Rapport de présence](Media/screenshot_app/rapport_presence.png)

### 👑 Pour les ADMINISTRATEURS

#### 1. Administration complète
- Accès à toutes les fonctionnalités superviseur
- **Messagerie avec tous les utilisateurs** (agents, superviseurs)
- Gestion des **unités administratives**
- Configuration des **paramètres système**

#### 2. Gestion des unités administratives
- Allez dans **"Administration"**
- Configurez les **départements, communes, arrondissements, villages**
- Définissez les **zones d'intervention** des agents

#### 3. Configuration système
- Paramètres de **tolérance GPS** (distance autorisée)
- Configuration des **notifications**
- Gestion des **sauvegardes**

## 🗺️ Comprendre la carte

### Marqueurs sur la carte
- 🟢 **Vert** : Agent présent et validé
- 🟠 **Orange** : Agent présent mais en dehors de la zone
- 🔴 **Rouge** : Agent absent ou problème de connexion
- 🔵 **Bleu** : Point de référence (village d'intervention)

### Légende des statuts
- **Présent** : Agent dans la zone autorisée (≤ 50km du village)
- **Hors zone** : Agent en dehors de la zone autorisée (> 50km)
- **Absent** : Aucun enregistrement de présence

## 📊 Comprendre les rapports

### Métriques principales
- **Total agents** : Nombre d'agents dans la période
- **Présents** : Agents qui ont marqué leur présence
- **Absents** : Agents sans enregistrement
- **Taux de présence** : Pourcentage de présence

### Types de rapports
- **Rapport quotidien** : Présence du jour
- **Rapport hebdomadaire** : Présence de la semaine
- **Rapport mensuel** : Présence du mois
- **Rapport par agent** : Historique d'un agent spécifique

## 🔧 Résolution des problèmes courants

### ❌ "Je ne peux pas me connecter"
**Solutions :**
1. Vérifiez votre email et mot de passe
2. Assurez-vous d'avoir une connexion internet
3. Contactez votre superviseur pour vérifier votre compte

### ❌ "Le GPS ne fonctionne pas"
**Solutions :**
1. Autorisez l'accès à la localisation dans votre navigateur
2. Vérifiez que le GPS est activé sur votre téléphone
3. Sortez à l'extérieur pour une meilleure réception

### ❌ "Je ne vois pas les agents sur la carte"
**Solutions :**
1. Vérifiez que vous êtes connecté avec un compte superviseur/admin
2. Actualisez la page (F5)
3. Vérifiez la période sélectionnée

### ❌ "L'application est lente"
**Solutions :**
1. Vérifiez votre connexion internet
2. Fermez les autres applications
3. Actualisez la page

## 📱 Installation sur mobile (PWA)

### Android
1. Ouvrez l'application dans Chrome
2. Appuyez sur le menu (3 points)
3. Sélectionnez "Ajouter à l'écran d'accueil"
4. L'icône apparaît sur votre écran d'accueil

### iPhone
1. Ouvrez l'application dans Safari
2. Appuyez sur le bouton de partage
3. Sélectionnez "Sur l'écran d'accueil"
4. L'icône apparaît sur votre écran d'accueil

## 🔒 Sécurité et confidentialité

### Protection des données
- Toutes les données sont **chiffrées** lors du transport
- Les mots de passe sont **sécurisés**
- Seuls les **superviseurs autorisés** peuvent voir vos données

### Respect de la vie privée
- Votre position n'est enregistrée que pendant vos **heures de travail**
- Vous pouvez **désactiver** le suivi à tout moment
- Vos données ne sont **jamais partagées** avec des tiers

## 📞 Support et assistance

### En cas de problème
1. **Consultez ce manuel** en premier
2. **Contactez votre superviseur** direct
3. **Appelez le support technique** : +229 0196911346

### Contacts utiles
- **Développeur de l'application**
- **Titre** : Data Analyst | Web Developer Fullstack | MEAL Officer
- **Email** : syebadokpo@gmail.com
- **Email (Organisation)** : conseil.riziculteurs.benin2006@gmail.com
- **Téléphone** : +229 0196911346 / +229 0164052710
- **LinkedIn** : [LinkedIn](https://linkedin.com/in/sidoine-yebadokpo)
- **Organisation** : Conseil de Concertation des Riziculteurs du Bénin (CCRB)

## 🎉 Félicitations !

Vous maîtrisez maintenant le système Presence CCRB. Ce système vous permet de :

✅ **Travailler efficacement** sur le terrain  
✅ **Prouver votre présence** avec des données GPS  
✅ **Gagner du temps** avec des rapports automatiques  
✅ **Rester connecté** avec votre équipe  
✅ **Avoir une trace** de votre travail quotidien  

## 📚 Résumé rapide

### Pour les agents
1. **Connectez-vous** avec vos identifiants
2. **Choisissez votre zone** d'intervention
3. **Marquez votre présence** au début et à la fin
4. **Ajoutez des photos** et notes si nécessaire
5. **Saisissez vos activités** et résultats dans le suivi d'activité
6. **Communiquez** avec votre équipe via la messagerie
7. **Consultez votre planning** et planifiez vos activités

### Pour les superviseurs
1. **Connectez-vous** avec un compte superviseur
2. **Gérez vos agents** dans la section Agents
3. **Suivez en temps réel** sur la carte
4. **Générez des rapports** selon vos besoins
5. **Suivez les activités** de vos agents avec filtres avancés
6. **Communiquez** avec vos équipes via la messagerie
7. **Consultez la synthèse globale** pour une vue d'ensemble
8. **Analysez les performances** avec les analytics

### Pour les administrateurs
1. **Configurez le système** dans Administration
2. **Gérez les unités** administratives
3. **Supervisez** l'ensemble des opérations
4. **Accédez à tous les modules** : rapports, analytics, synthèse globale
5. **Gérez les projets** et affectations
6. **Configurez les paramètres** avancés du système

---

**Bonne utilisation du système Presence CCRB !** 🚀

*Développé pour le Conseil de Concertation des Riziculteurs du Bénin (CCRB)*
