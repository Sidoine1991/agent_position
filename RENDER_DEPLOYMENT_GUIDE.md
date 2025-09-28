# Guide de Déploiement Render

Ce guide vous explique comment déployer votre application Presence CCRB sur Render avec la configuration Supabase.

## Variables d'Environnement Requises

### Variables Obligatoires

Ces variables sont **requises** pour que l'application fonctionne :

| Variable | Description | Exemple |
|----------|-------------|---------|
| `SUPABASE_URL` | URL de votre projet Supabase | `https://xyzabc123.supabase.co` |
| `SUPABASE_ANON_KEY` | Clé anonyme Supabase | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
| `SUPABASE_SERVICE_ROLE` | Clé service role Supabase | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |

### Variables Optionnelles

Ces variables ont des valeurs par défaut mais peuvent être personnalisées :

| Variable | Description | Valeur par défaut |
|----------|-------------|-------------------|
| `JWT_SECRET` | Clé secrète pour JWT | Clé par défaut (non sécurisée) |
| `CORS_ORIGIN` | URL du frontend | `http://localhost:3000` |
| `PORT` | Port du serveur | `3000` |
| `NODE_ENV` | Environnement | `development` |

### Variables pour Email (Optionnelles)

Pour activer l'envoi d'emails de vérification :

| Variable | Description |
|----------|-------------|
| `EMAIL_USER` | Adresse Gmail |
| `EMAIL_PASS` | Mot de passe d'application Gmail |

## Configuration dans Render

### 1. Obtenir les Clés Supabase

1. Connectez-vous à [Supabase](https://supabase.com)
2. Sélectionnez votre projet
3. Allez dans **Settings** → **API**
4. Copiez les valeurs suivantes :
   - **Project URL** → `SUPABASE_URL`
   - **anon public** → `SUPABASE_ANON_KEY`
   - **service_role** → `SUPABASE_SERVICE_ROLE`

### 2. Configurer les Variables dans Render

1. Connectez-vous à [Render](https://render.com)
2. Sélectionnez votre service web
3. Allez dans l'onglet **Environment**
4. Ajoutez les variables d'environnement :

```
SUPABASE_URL=https://votre-projet-id.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
JWT_SECRET=votre-cle-secrete-jwt-securisee
CORS_ORIGIN=https://votre-frontend-url.com
```

### 3. Configuration Email (Optionnel)

Si vous voulez activer l'envoi d'emails :

1. Créez un compte Gmail dédié
2. Activez l'authentification à 2 facteurs
3. Générez un mot de passe d'application
4. Ajoutez ces variables :

```
EMAIL_USER=votre-email@gmail.com
EMAIL_PASS=votre-mot-de-passe-application
```

## Vérification du Déploiement

### 1. Logs de Démarrage

Après le déploiement, vérifiez les logs. Vous devriez voir :

```
🔄 Redirection vers server.js...
🔗 Supabase activé (mode exclusif)
✅ Connexion Supabase établie
🚀 Serveur démarré sur le port 3000
📊 Base de données: Supabase uniquement
```

### 2. Tests de Santé

Testez ces endpoints pour vérifier que tout fonctionne :

- `GET /api/test-server` - Test du serveur
- `GET /api/supabase-health` - Test de la connexion Supabase

### 3. Erreurs Communes

#### Variables manquantes
```
❌ Variables d'environnement manquantes: SUPABASE_URL, SUPABASE_ANON_KEY
```
**Solution** : Vérifiez que toutes les variables obligatoires sont configurées.

#### Erreur de connexion Supabase
```
❌ Erreur de connexion Supabase: Cannot read properties of null (reading 'from')
```
**Solution** : Vérifiez que vos clés Supabase sont correctes et que votre projet est actif.

#### CORS Error
```
Access to fetch at 'https://votre-app.onrender.com' from origin 'https://votre-frontend.com' has been blocked by CORS policy
```
**Solution** : Configurez `CORS_ORIGIN` avec l'URL de votre frontend.

## Sécurité

### Recommandations

1. **JWT_SECRET** : Utilisez une clé forte et unique
2. **SUPABASE_SERVICE_ROLE** : Gardez cette clé secrète, elle a des privilèges élevés
3. **CORS_ORIGIN** : Limitez aux domaines autorisés
4. **NODE_ENV** : Définissez sur `production` en production

### Génération d'une Clé JWT Sécurisée

```bash
# Générer une clé JWT sécurisée
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Dépannage

### Problèmes Fréquents

1. **Déploiement échoue** : Vérifiez les variables d'environnement
2. **Base de données inaccessible** : Vérifiez les clés Supabase
3. **Emails non envoyés** : Vérifiez la configuration Gmail
4. **CORS errors** : Vérifiez `CORS_ORIGIN`

### Support

- [Documentation Render](https://render.com/docs)
- [Documentation Supabase](https://supabase.com/docs)
- [Guide CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
