# Configuration Email - Presence CCRB

## Problème résolu ✅

Le problème d'envoi d'emails de vérification a été corrigé. Les agents recevront maintenant les codes de vérification par email.

## Changements effectués

1. **Ajout de la fonction d'envoi d'email** dans `api/index.js`
2. **Modification de la route d'inscription** pour envoyer automatiquement les emails
3. **Ajout des routes de vérification** (`/api/verify` et `/api/resend-code`)
4. **Génération de codes à 6 chiffres** au lieu de codes hexadécimaux

## Configuration requise

### Variables d'environnement

Ajoutez ces variables à votre fichier `.env` ou configurez-les sur Vercel :

```env
# Configuration email (REQUIS)
EMAIL_USER=votre-email@gmail.com
EMAIL_PASS=votre-mot-de-passe-application
```

### Configuration Gmail

1. **Activez la validation en 2 étapes** sur votre compte Google
2. **Générez un "App Password"** :
   - Allez dans [Paramètres Google](https://myaccount.google.com/)
   - Sécurité → Validation en 2 étapes
   - Mots de passe des applications
   - Générez un nouveau mot de passe pour "Mail"
3. **Utilisez ce mot de passe** (16 caractères) dans `EMAIL_PASS`

## Fonctionnement

### Pour les agents normaux
- L'email de vérification est envoyé à l'adresse email de l'agent
- Le code à 6 chiffres est affiché clairement dans l'email

### Pour les administrateurs
- L'email de vérification est envoyé à `syebadokpo@gmail.com`
- L'email contient le code ET l'adresse email du nouveau compte admin

## Test de la configuration

Vous pouvez tester l'envoi d'email en utilisant l'endpoint de debug (si disponible) :

```bash
curl -X POST https://votre-domaine.vercel.app/api/debug/email/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer VOTRE_TOKEN_ADMIN" \
  -d '{"to": "test@example.com", "subject": "Test", "text": "Test email"}'
```

## Vérification

1. **Créez un nouveau compte** via la page d'inscription
2. **Vérifiez votre boîte email** (et les spams)
3. **Entrez le code à 6 chiffres** reçu
4. **Le compte sera activé** automatiquement

## Dépannage

### Email non reçu
1. Vérifiez les spams/courrier indésirable
2. Vérifiez que `EMAIL_USER` et `EMAIL_PASS` sont correctement configurés
3. Vérifiez les logs de l'application pour les erreurs d'envoi

### Code invalide
1. Le code expire après 24 heures
2. Utilisez le bouton "Renvoyer le code" si nécessaire
3. Vérifiez que vous entrez exactement 6 chiffres

### Erreur de configuration
```
Configuration email manquante - EMAIL_USER et EMAIL_PASS requis
```
→ Configurez les variables d'environnement `EMAIL_USER` et `EMAIL_PASS`

## Support

Si vous rencontrez des problèmes :
1. Vérifiez la configuration des variables d'environnement
2. Testez avec un compte Gmail valide
3. Consultez les logs de l'application pour plus de détails
