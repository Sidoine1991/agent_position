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

### 📊 Tableaux de Bord
- **Vue d'ensemble** des activités en cours
- **Statistiques** de présence et de productivité
- **Cartographie** des interventions
- **Alertes** en temps réel

### 🔄 Synchronisation
- **Mode hors-ligne** avec synchronisation automatique
- **Multi-appareils** (mobile et web)
- **Export des données** (PDF, Excel, CSV)
- **API** pour intégration avec d'autres systèmes

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

### 🔹 Superviseurs
- **Suivi en temps réel** des équipes
- **Validation** des présences
- **Gestion des plannings**
- **Génération de rapports** d'activité

### 🔹 Administrateurs
- **Configuration** du système
- **Gestion des utilisateurs** et des droits
- **Supervision** des données
- **Maintenance** de l'application

## 📚 Documentation Technique

### Architecture
- **Frontend** : React.js avec Material-UI
- **Backend** : Node.js avec Express
- **Base de données** : PostgreSQL via Supabase
- **Authentification** : JWT

### API REST
Les endpoints principaux sont :
- `POST /api/auth/login` - Authentification
- `GET /api/presence` - Récupérer les présences
- `POST /api/presence` - Enregistrer une présence
- `GET /api/reports` - Générer des rapports

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

### Sur Ordinateur (Pour superviseurs et admins)
1. Ouvrez votre navigateur
2. Allez à l'adresse : `https://presence-ccrb-v2.onrender.com`
3. Utilisez l'interface web complète

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
- Chiffrement des données sensibles
- Sauvegardes automatiques
- Journalisation des accès
- Conformité RGPD

### Bonnes pratiques
- Utilisez des mots de passe complexes
- Activez l'authentification à deux facteurs
- Ne partagez pas vos identifiants
- Signalez toute activité suspecte

## 🤝 Contribution

### Développement
1. Forkez le dépôt
2. Créez une branche pour votre fonctionnalité
3. Soumettez une pull request

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
- Recevez des **notifications** pour les nouveaux messages

#### 3. Choisir votre zone d'intervention
- **Département** : Sélectionnez votre département
- **Commune** : Choisissez votre commune
- **Arrondissement** : Sélectionnez l'arrondissement
- **Village** : Choisissez le village où vous travaillez

#### 4. Marquer votre présence

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

#### 5. Consulter votre historique
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

#### 5. Générer des rapports
- Allez dans **"Rapports"**
- Choisissez la **période** (aujourd'hui, cette semaine, ce mois)
- Sélectionnez un **agent** ou tous les agents
- Cliquez sur **"Générer le rapport"**
- **Exportez** en Excel ou PDF

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

### Pour les superviseurs
1. **Connectez-vous** avec un compte superviseur
2. **Gérez vos agents** dans la section Agents
3. **Suivez en temps réel** sur la carte
4. **Générez des rapports** selon vos besoins

### Pour les administrateurs
1. **Configurez le système** dans Administration
2. **Gérez les unités** administratives
3. **Supervisez** l'ensemble des opérations

---

**Bonne utilisation du système Presence CCRB !** 🚀

*Développé pour le Conseil de Concertation des Riziculteurs du Bénin (CCRB)*
