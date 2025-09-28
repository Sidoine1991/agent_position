# Guide de Déploiement Vercel

Ce guide vous explique comment déployer votre application Presence CCRB sur Vercel avec la configuration Supabase.

## Configuration Vercel

### 1. Variables d'Environnement

#### Variables Obligatoires

| Variable | Description | Exemple |
|----------|-------------|---------|
| `SUPABASE_URL` | URL de votre projet Supabase | `https://xyzabc123.supabase.co` |
| `SUPABASE_ANON_KEY` | Clé anonyme Supabase | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `SUPABASE_SERVICE_ROLE` | Clé service role Supabase | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |

#### Variables Optionnelles

| Variable | Description | Valeur par défaut |
|----------|-------------|-------------------|
| `JWT_SECRET` | Clé secrète pour JWT | `default-secret-change-in-production` |
| `CORS_ORIGIN` | URL du frontend | `https://agent-position.vercel.app` |
| `NODE_ENV` | Environnement | `production` |

### 2. Configuration dans Vercel

#### Étape 1 : Obtenir les Clés Supabase

1. Connectez-vous à [Supabase](https://supabase.com)
2. Sélectionnez votre projet
3. Allez dans **Settings** → **API**
4. Copiez les valeurs suivantes :
   - **Project URL** → `SUPABASE_URL`
   - **anon public** → `SUPABASE_ANON_KEY`
   - **service_role** → `SUPABASE_SERVICE_ROLE`

#### Étape 2 : Configurer les Variables dans Vercel

1. Connectez-vous à [Vercel](https://vercel.com)
2. Sélectionnez votre projet
3. Allez dans **Settings** → **Environment Variables**
4. Ajoutez les variables d'environnement :

```
SUPABASE_URL=https://votre-projet-id.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
JWT_SECRET=votre-cle-secrete-jwt-securisee
CORS_ORIGIN=https://votre-projet.vercel.app
```

#### Étape 3 : Configurer par Environnement

Vercel permet de configurer des variables différentes par environnement :

- **Development** : Variables pour les branches de développement
- **Preview** : Variables pour les pull requests
- **Production** : Variables pour la branche principale

**Recommandation :** Configurez les variables pour **tous les environnements**.

### 3. Architecture Vercel

Votre projet utilise une architecture hybride :

- **API Routes** : `/api/*` → `api/index.js` (serverless functions)
- **Static Files** : `/web/*` → fichiers statiques
- **Main Server** : `server.js` (fallback)

#### Fichiers de Configuration

- `vercel.json` : Configuration du déploiement
- `api/index.js` : API serverless principale
- `server.js` : Serveur de fallback

### 4. Déploiement

#### Déploiement Automatique

Vercel déploie automatiquement à chaque push :
- **Push sur main** → Déploiement en production
- **Pull Request** → Déploiement en preview
- **Push sur autre branche** → Déploiement en développement

#### Déploiement Manuel

1. Allez dans votre dashboard Vercel
2. Cliquez sur **Deployments**
3. Cliquez sur **Redeploy** sur le déploiement souhaité

### 5. Vérification du Déploiement

#### Logs de Déploiement

Vérifiez les logs dans :
1. Dashboard Vercel → **Deployments**
2. Cliquez sur le déploiement
3. Onglet **Function Logs**

#### Tests de Santé

Testez ces endpoints :

- `GET /api/test-server` - Test du serveur
- `GET /api/supabase-health` - Test de la connexion Supabase

#### Exemple de Réponse Attendue

```json
{
  "status": "OK",
  "database": "Supabase",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 6. Avantages Vercel vs Render

#### Vercel
- ✅ **Déploiement automatique** à chaque push
- ✅ **Fonctions serverless** (pas de serveur permanent)
- ✅ **Environnements multiples** (dev/preview/prod)
- ✅ **CDN global** pour les fichiers statiques
- ✅ **Intégration GitHub** native

#### Render
- ✅ **Serveur permanent** (toujours actif)
- ✅ **Configuration simple**
- ✅ **Logs en temps réel**
- ✅ **Redémarrage automatique**

### 7. Dépannage

#### Problèmes Fréquents

1. **Variables d'environnement non définies**
   ```
   Error: Supabase non configuré: veuillez définir SUPABASE_URL et SUPABASE_ANON_KEY
   ```
   **Solution** : Vérifiez que les variables sont configurées dans Vercel

2. **CORS Errors**
   ```
   Access to fetch at 'https://votre-app.vercel.app' from origin 'https://votre-frontend.com' has been blocked by CORS policy
   ```
   **Solution** : Configurez `CORS_ORIGIN` avec l'URL de votre frontend

3. **Fonction timeout**
   ```
   Function execution timed out
   ```
   **Solution** : Vercel a une limite de 10s pour les fonctions gratuites

#### Debugging

1. **Logs Vercel** : Dashboard → Deployments → Function Logs
2. **Logs locaux** : `vercel dev` pour tester localement
3. **Test API** : Utilisez Postman ou curl pour tester les endpoints

### 8. Commandes Utiles

```bash
# Installer Vercel CLI
npm i -g vercel

# Déploiement local
vercel dev

# Déploiement en production
vercel --prod

# Voir les logs
vercel logs

# Voir les variables d'environnement
vercel env ls
```

### 9. Sécurité

#### Recommandations

1. **JWT_SECRET** : Utilisez une clé forte et unique
2. **SUPABASE_SERVICE_ROLE** : Gardez cette clé secrète
3. **CORS_ORIGIN** : Limitez aux domaines autorisés
4. **Variables sensibles** : Ne les commitez jamais dans le code

#### Génération d'une Clé JWT Sécurisée

```bash
# Générer une clé JWT sécurisée
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 10. Support

- [Documentation Vercel](https://vercel.com/docs)
- [Documentation Supabase](https://supabase.com/docs)
- [Vercel CLI](https://vercel.com/docs/cli)
- [Environment Variables](https://vercel.com/docs/environment-variables)
