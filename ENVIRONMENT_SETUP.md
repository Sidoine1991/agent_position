# Configuration des Variables d'Environnement

## 🔐 Sécurité

**IMPORTANT** : Ne jamais commiter les vraies clés JWT ou secrets dans le code !

## 📋 Variables d'Environnement Requises

### Pour Vercel (Production)

Configurez ces variables dans votre dashboard Vercel :

1. **Allez sur** : https://vercel.com/yebadokpo-sidoines-projects/agent-position/settings/environment-variables

2. **Ajoutez ces variables** :

```
JWT_SECRET=3fc6fb0fdb066cfc829a6ff25b05c14c2fd491c3c2b64762363dc23604153285ef8eb3d4afa70bdfae3e506cd26b9b9ebf44be7c8d7871f685b73b66e157551a
CORS_ORIGIN=https://agent-position.vercel.app
VERCEL_PROJECT_ID=prj_FuhngVbz3oLxi1tTn3bshjO2XXg4
NODE_ENV=production
```

### Pour le Développement Local

Créez un fichier `.env` dans la racine du projet :

```bash
# .env (ne pas commiter ce fichier)
JWT_SECRET=your_development_secret_here
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development
```

## 🚀 Configuration Vercel

### Étapes pour configurer les variables d'environnement :

1. **Connectez-vous** à votre dashboard Vercel
2. **Sélectionnez** votre projet `agent-position`
3. **Allez dans** Settings → Environment Variables
4. **Ajoutez** chaque variable une par une :
   - **Name** : `JWT_SECRET`
   - **Value** : `3fc6fb0fdb066cfc829a6ff25b05c14c2fd491c3c2b64762363dc23604153285ef8eb3d4afa70bdfae3e506cd26b9b9ebf44be7c8d7871f685b73b66e157551a`
   - **Environment** : Production, Preview, Development

5. **Répétez** pour toutes les variables
6. **Redéployez** votre application

## 🔒 Bonnes Pratiques de Sécurité

- ✅ **Utilisez des clés longues** (128+ caractères)
- ✅ **Générez des clés uniques** pour chaque environnement
- ✅ **Ne commitez jamais** les vraies clés
- ✅ **Utilisez des variables d'environnement** pour tous les secrets
- ✅ **Rotez régulièrement** vos clés JWT

## 🛠️ Génération de Clés JWT Sécurisées

### En ligne de commande :
```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# OpenSSL
openssl rand -hex 64

# PowerShell
[System.Web.Security.Membership]::GeneratePassword(128, 0)
```

## 📞 Support

Si vous avez des questions sur la configuration des variables d'environnement, consultez :
- [Documentation Vercel](https://vercel.com/docs/environment-variables)
- [Guide de sécurité JWT](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/)
