# Base de Données CCRB - Systèmes Avancés

Ce dossier contient tous les scripts SQL nécessaires pour configurer la base de données Supabase pour les systèmes avancés de l'application CCRB.

## 📁 Fichiers Inclus

### Scripts Principaux

1. **`supabase_tables.sql`** - Script complet de création de toutes les tables
2. **`check_and_create_tables.sql`** - Script intelligent qui vérifie et crée seulement les tables manquantes
3. **`check_existing_tables.sql`** - Script de vérification de l'état actuel de la base de données
4. **`migrate_existing_users.sql`** - Script de migration pour les utilisateurs existants
5. **`test_database_setup.sql`** - Script de test complet de toutes les fonctionnalités

### Documentation

6. **`DATABASE_ARCHITECTURE.md`** - Documentation complète de l'architecture
7. **`README.md`** - Ce fichier d'instructions

## 🚀 Installation Rapide

### Pour une nouvelle installation

```sql
-- 1. Exécuter le script simplifié (recommandé)
\i create_tables_simple.sql

-- 2. Tester la configuration
\i test_simple.sql
```

### Pour une installation existante

```sql
-- 1. Vérifier l'état actuel
\i check_existing_tables.sql

-- 2. Créer les tables manquantes (script corrigé)
\i check_and_create_tables.sql

-- 3. Migrer les utilisateurs existants
\i migrate_existing_users.sql

-- 4. Tester la configuration
\i test_simple.sql
```

### Scripts Alternatifs

```sql
-- Script complet (si vous préférez)
\i supabase_tables.sql

-- Test complet (plus détaillé)
\i test_database_setup.sql
```

## 📊 Systèmes Supportés

### 1. 🗨️ Messagerie Interne
- **Tables**: `conversations`, `conversation_participants`, `messages`, `message_read_status`
- **Fonctionnalités**: Chat en temps réel, messages multimédias, indicateurs de frappe

### 2. 🚨 Système d'Urgence
- **Tables**: `emergency_contacts`, `emergency_alerts`, `emergency_notifications`
- **Fonctionnalités**: Bouton SOS, alertes automatiques, géolocalisation d'urgence

### 3. 📋 Rapports Enrichis
- **Tables**: `report_types`, `enriched_reports`, `report_media`
- **Fonctionnalités**: Formulaires dynamiques, photos, audio, signatures électroniques

### 4. 🧠 Planification Intelligente
- **Tables**: `route_optimizations`, `planning_conflicts`, `optimization_suggestions`
- **Fonctionnalités**: Optimisation d'itinéraires, détection de conflits, suggestions

### 5. 📊 Tableau de Bord Agent
- **Tables**: `personal_goals`, `badges`, `user_badges`, `achievements`, `leaderboard`
- **Fonctionnalités**: Objectifs personnels, système de badges, classements

### 6. 🆘 Aide Intégrée
- **Tables**: `tutorials`, `tutorial_progress`, `faqs`, `contextual_help`
- **Fonctionnalités**: Tutoriels interactifs, FAQ, aide contextuelle

### 7. 📈 Analytics et Insights
- **Tables**: `performance_metrics`, `insights`, `predictions`, `analytics_data`
- **Fonctionnalités**: Métriques de performance, insights automatiques, prédictions

### 8. 📍 Géolocalisation Avancée
- **Tables**: `gps_positions`, `geographic_zones`, `geofencing_events`
- **Fonctionnalités**: Suivi GPS continu, géofencing, zones de travail

### 9. 🔔 Notifications Push
- **Tables**: `notification_subscriptions`, `notifications`
- **Fonctionnalités**: Notifications en temps réel, gestion des abonnements

### 10. 💾 Cache Hors-ligne
- **Tables**: `offline_sync`
- **Fonctionnalités**: Synchronisation hors-ligne, queue des actions

## 🔧 Configuration

### Prérequis

1. **Supabase** - Base de données PostgreSQL configurée
2. **Table `users`** - Doit exister avec les colonnes de base
3. **Permissions** - Droits d'administration sur la base de données

### Variables d'Environnement

Assurez-vous que ces variables sont configurées dans Supabase :

```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## 🛠️ Utilisation des Scripts

### Script de Vérification

```sql
-- Vérifier l'état de la base de données
\i check_existing_tables.sql
```

Ce script affiche :
- ✅ Tables existantes
- ❌ Tables manquantes
- Index et triggers présents
- Données initiales

### Script de Création Intelligente

```sql
-- Créer seulement les tables manquantes
\i check_and_create_tables.sql
```

Ce script :
- Vérifie l'existence de chaque table
- Crée seulement celles qui manquent
- Ajoute les index et triggers nécessaires
- Insère les données initiales

### Script de Migration

```sql
-- Migrer les utilisateurs existants
\i migrate_existing_users.sql
```

Ce script :
- Crée des objectifs par défaut pour tous les agents
- Attribue le badge "Débutant" aux utilisateurs existants
- Configure les contacts d'urgence
- Initialise les métriques de performance

### Script de Test

```sql
-- Tester toutes les fonctionnalités
\i test_database_setup.sql
```

Ce script :
- Crée des données de test
- Teste toutes les fonctionnalités
- Vérifie les contraintes et relations
- Nettoie les données de test

## 🔒 Sécurité

### Row Level Security (RLS)

Toutes les tables sensibles ont RLS activé avec des politiques qui permettent :

- **Utilisateurs** : Accès à leurs propres données
- **Superviseurs** : Accès aux données de leurs agents
- **Administrateurs** : Accès à toutes les données

### Politiques de Sécurité

```sql
-- Exemple de politique pour les messages
CREATE POLICY "Users can view messages in their conversations" ON messages
    FOR SELECT USING (
        conversation_id IN (
            SELECT conversation_id FROM conversation_participants 
            WHERE user_id = auth.uid()
        )
    );
```

## 📈 Performance

### Index Optimisés

Index créés sur :
- Clés étrangères (`user_id`, `conversation_id`)
- Colonnes de recherche (`status`, `created_at`)
- Colonnes de tri (`score`, `timestamp`)
- Colonnes géographiques (`latitude`, `longitude`)

### Optimisations

1. **Partitioning** - Tables de logs partitionnées par date
2. **Archiving** - Archivage des anciennes données
3. **Caching** - Mise en cache des métriques calculées
4. **Compression** - Compression des données JSON

## 🚨 Dépannage

### Erreurs Communes

1. **Table `users` manquante**
   ```sql
   -- Créer la table users de base
   CREATE TABLE users (
       id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
       email VARCHAR(255) UNIQUE NOT NULL,
       first_name VARCHAR(255),
       last_name VARCHAR(255),
       role VARCHAR(50) DEFAULT 'agent',
       is_active BOOLEAN DEFAULT true,
       created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );
   ```

2. **Permissions insuffisantes**
   ```sql
   -- Vérifier les permissions
   SELECT current_user, session_user;
   
   -- Accorder les permissions nécessaires
   GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_user;
   ```

3. **Contraintes de clés étrangères**
   ```sql
   -- Vérifier les contraintes
   SELECT * FROM information_schema.table_constraints 
   WHERE constraint_type = 'FOREIGN KEY';
   ```

### Logs et Monitoring

```sql
-- Vérifier les logs d'erreur
SELECT * FROM pg_stat_database WHERE datname = current_database();

-- Vérifier l'espace utilisé
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## 📞 Support

### Ressources

1. **Documentation Supabase** - https://supabase.com/docs
2. **PostgreSQL Documentation** - https://www.postgresql.org/docs/
3. **Architecture CCRB** - Voir `DATABASE_ARCHITECTURE.md`

### Contact

Pour toute question ou problème :
- Vérifiez d'abord les logs d'erreur
- Consultez la documentation d'architecture
- Testez avec le script de test complet

## 🎯 Prochaines Étapes

Après l'installation :

1. **Configurer les API** - Mettre à jour les endpoints dans l'application
2. **Tester les fonctionnalités** - Utiliser le script de test
3. **Configurer les notifications** - Paramétrer les services push
4. **Former les utilisateurs** - Utiliser les tutoriels intégrés
5. **Monitorer les performances** - Surveiller les métriques

---

**🎉 Félicitations !** Votre base de données CCRB est maintenant prête pour supporter tous les systèmes avancés de l'application.
