# 🗄️ Guide de Configuration de la Base de Données Supabase

## 📋 **Vue d'ensemble des Tables Nécessaires**

Basé sur l'analyse des pages HTML, voici les tables requises pour l'application Presence CCRB:

### **✅ Tables Existantes**
- `users` - Utilisateurs (agents, superviseurs, admins)
- `missions` - Missions des agents
- `checkins` - Points de présence
- `absences` - Absences des agents
- `reports` - Rapports de présence
- `verification_codes` - Codes de vérification
- `app_settings` - Paramètres de l'application

### **❌ Tables Manquantes à Créer**
- `departements` - Départements du Bénin
- `communes` - Communes
- `arrondissements` - Arrondissements
- `villages` - Villages
- `admin_units` - Unités administratives
- `system_settings` - Paramètres système détaillés
- `custom_reports` - Rapports personnalisés
- `notifications` - Notifications utilisateurs
- `user_sessions` - Sessions utilisateurs
- `activity_logs` - Logs d'activité

## 🚀 **Instructions de Configuration**

### **Étape 1: Créer le Schema Complet**

1. **Allez dans Supabase Dashboard**
   - URL: https://supabase.com/dashboard
   - Sélectionnez votre projet

2. **Ouvrez SQL Editor**
   - Cliquez sur "SQL Editor" dans le menu de gauche

3. **Exécutez le Script SQL Complet**
   - Copiez le contenu du fichier `supabase/schema.sql`
   - Collez-le dans l'éditeur SQL
   - Cliquez sur "Run" pour exécuter

### **Étape 2: Insérer les Données Initiales**

Après avoir créé les tables, exécutez:

```bash
node scripts/insert-initial-data.js
```

Ce script va insérer:
- ✅ Départements du Bénin
- ✅ Paramètres système
- ✅ Communes principales
- ✅ Superadmin (syebadokpo@gmail.com / 123456)
- ✅ Unités administratives

### **Étape 3: Vérifier la Configuration**

```bash
node scripts/verify-supabase.js
```

## 📊 **Modélisation des Données**

### **Relations Principales**

```
users (1) ←→ (N) missions
users (1) ←→ (N) checkins
users (1) ←→ (N) notifications
users (1) ←→ (N) user_sessions
users (1) ←→ (N) activity_logs

departements (1) ←→ (N) communes
communes (1) ←→ (N) arrondissements
arrondissements (1) ←→ (N) villages

admin_units (1) ←→ (N) admin_units (parent/child)
users (1) ←→ (N) admin_units (manager)
```

### **Données Géographiques**

| Table | Description | Exemple |
|-------|-------------|---------|
| `departements` | Départements du Bénin | Atacora, Borgou, Littoral |
| `communes` | Communes | Cotonou, Porto-Novo, Parakou |
| `arrondissements` | Arrondissements | Centre, Nord, Sud |
| `villages` | Villages | Village A, Village B |

### **Données Système**

| Table | Description | Usage |
|-------|-------------|-------|
| `system_settings` | Paramètres globaux | Fuseau horaire, heures de travail |
| `admin_units` | Unités administratives | CCRB, Départements |
| `notifications` | Notifications | Alertes, rappels |
| `activity_logs` | Logs d'activité | Audit, sécurité |

## 🔧 **Configuration des Variables d'Environnement**

Assurez-vous que ces variables sont définies:

```env
SUPABASE_URL=https://eoamsmtdspedumjmmeui.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_JWT_SECRET=wineLDVtm0QzgEUg57/bJFMCdWjrjdwYi0Y5dg9BaF2mQlpE6gL6XgCQNtDB2yAry7hY4R9vL6RXtD3Sqjc7NA==
```

## 🧪 **Tests de Validation**

### **Test 1: Vérification des Tables**
```bash
node scripts/verify-supabase.js
```

### **Test 2: Test de Connexion**
```bash
node test-user-login.js
```

### **Test 3: Test Complet**
```bash
npm run test:all
```

## 📱 **Pages HTML Analysées**

### **Pages Principales**
- `index.html` - Page d'accueil agent
- `dashboard.html` - Tableau de bord
- `profile.html` - Profil utilisateur
- `admin.html` - Administration
- `agents.html` - Gestion des agents
- `reports.html` - Rapports

### **Données Identifiées**
- **Utilisateurs**: Nom, email, téléphone, rôle, photo
- **Géolocalisation**: Coordonnées GPS, adresses
- **Présence**: Missions, checkins, absences
- **Configuration**: Paramètres système, notifications
- **Rapports**: Statistiques, filtres, exports

## 🚨 **Dépannage**

### **Erreur: "Table does not exist"**
- Vérifiez que les tables ont été créées dans Supabase Dashboard
- Exécutez le script SQL manuellement

### **Erreur: "Permission denied"**
- Vérifiez les politiques RLS dans Supabase
- Assurez-vous que les clés API sont correctes

### **Erreur: "Connection failed"**
- Vérifiez les variables d'environnement
- Testez la connexion avec `node scripts/verify-supabase.js`

## 📋 **Checklist de Validation**

- [ ] Tables créées dans Supabase
- [ ] Données initiales insérées
- [ ] Variables d'environnement configurées
- [ ] Tests de connexion réussis
- [ ] Application déployée sur Vercel/Render
- [ ] Fonctionnalités testées

## 🎯 **Prochaines Étapes**

1. **Créer les tables** avec le script SQL
2. **Insérer les données** avec le script Node.js
3. **Tester l'application** localement
4. **Déployer** sur Vercel/Render
5. **Valider** toutes les fonctionnalités

---

**Note**: Ce guide couvre tous les aspects nécessaires pour configurer une base de données complète pour l'application Presence CCRB.
