# Guide de configuration Gmail pour l'envoi d'emails

## Problème courant
Les emails de vérification ne sont pas reçus car Gmail bloque les connexions non sécurisées.

## Solution : Configuration Gmail avec App Password

### Étape 1 : Activer la validation en 2 étapes
1. Allez sur https://myaccount.google.com/security
2. Connectez-vous à votre compte Google
3. Dans "Connexion à Google", cliquez sur "Validation en 2 étapes"
4. Suivez les instructions pour l'activer

### Étape 2 : Générer un App Password
1. Toujours dans https://myaccount.google.com/security
2. Dans "Validation en 2 étapes", cliquez sur "Mots de passe des applications"
3. Sélectionnez "Autre (nom personnalisé)"
4. Tapez "Presence CCRB" comme nom
5. Cliquez sur "Générer"
6. **Copiez le mot de passe de 16 caractères** (ex: abcd efgh ijkl mnop)

### Étape 3 : Configurer l'application
1. Créez un fichier `.env` à la racine du projet
2. Ajoutez ces lignes :
```env
EMAIL_USER=votre-email@gmail.com
EMAIL_PASS=abcd efgh ijkl mnop
```

### Étape 4 : Redémarrer le serveur
```bash
npm start
# ou
node server.js
```

## Vérification
1. Essayez de créer un compte
2. Vérifiez votre boîte email
3. **Important** : Vérifiez aussi le dossier "Spam" ou "Courrier indésirable"

## Alternative : Utiliser un autre service email

Si Gmail ne fonctionne pas, vous pouvez utiliser :

### SendGrid (Recommandé)
```env
EMAIL_SERVICE=sendgrid
SENDGRID_API_KEY=your-sendgrid-api-key
EMAIL_FROM=noreply@yourdomain.com
```

### Mailgun
```env
EMAIL_SERVICE=mailgun
MAILGUN_API_KEY=your-mailgun-api-key
MAILGUN_DOMAIN=your-mailgun-domain
```

## Dépannage

### Email reçu mais dans le spam
- Ajoutez l'expéditeur à vos contacts
- Marquez comme "Non spam"
- Configurez un filtre Gmail

### Erreur "Invalid login"
- Vérifiez que la validation en 2 étapes est activée
- Utilisez un App Password, pas votre mot de passe normal
- Vérifiez que l'App Password est correct

### Erreur "Less secure app access"
- Cette option est obsolète
- Utilisez toujours un App Password

## Test de configuration
Exécutez le script de test :
```bash
node database/check_email_config.js
```
