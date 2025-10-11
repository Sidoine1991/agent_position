# Guide du Super Admin - Gestion des codes de vérification

## 📞 Contact Super Admin
- **Email** : syebadokpo@gmail.com
- **Téléphone** : +229 01 96 91 13 46

## 🛠️ Outils disponibles

### 1. Script d'aide pour les codes de vérification
Le fichier `database/admin_verification_helper.js` permet de gérer les codes de vérification.

#### Commandes disponibles :

**Lister les utilisateurs non vérifiés :**
```bash
node database/admin_verification_helper.js list
```

**Générer un nouveau code pour un utilisateur :**
```bash
node database/admin_verification_helper.js generate user@example.com
```

**Vérifier manuellement un utilisateur :**
```bash
node database/admin_verification_helper.js verify user@example.com
```

### 2. Désactiver temporairement la vérification
Si le problème d'email persiste, vous pouvez désactiver temporairement la vérification :

1. Allez dans la console Supabase
2. Exécutez le script `database/disable_email_verification.sql`
3. Tous les utilisateurs existants seront marqués comme vérifiés

## 📧 Problèmes d'email courants

### Causes possibles :
1. **Emails dans le spam** - Vérifiez le dossier courrier indésirable
2. **Configuration Gmail incorrecte** - Vérifiez les App Passwords
3. **Filtres email** - Certains fournisseurs bloquent les emails automatiques
4. **Adresse email incorrecte** - Vérifiez l'orthographe

### Solutions :
1. **Solution immédiate** : Utiliser le script pour générer un code alternatif
2. **Solution temporaire** : Désactiver la vérification email
3. **Solution permanente** : Configurer un service email professionnel (SendGrid, Mailgun)

## 🔧 Configuration email (pour les développeurs)

### Variables d'environnement requises :
```env
EMAIL_USER=votre-email@gmail.com
EMAIL_PASS=votre-app-password-16-caracteres
```

### Test de configuration :
```bash
node database/check_email_config.js
```

## 📋 Procédure d'aide utilisateur

### Quand un utilisateur contacte le super admin :

1. **Vérifier l'utilisateur** :
   ```bash
   node database/admin_verification_helper.js list
   ```

2. **Générer un code alternatif** :
   ```bash
   node database/admin_verification_helper.js generate email@utilisateur.com
   ```

3. **Communiquer le code** :
   - Par email : Envoyer le code généré
   - Par téléphone : Donner le code directement

4. **Si le problème persiste** :
   - Vérifier manuellement l'utilisateur :
   ```bash
   node database/admin_verification_helper.js verify email@utilisateur.com
   ```

## 🚨 Urgences

### Si le système d'email ne fonctionne plus :
1. Désactiver temporairement la vérification
2. Notifier les utilisateurs par email/téléphone
3. Réparer la configuration email
4. Réactiver la vérification

### Script d'urgence :
```sql
-- Marquer tous les utilisateurs comme vérifiés
UPDATE users SET is_verified = true WHERE is_verified = false;
```

## 📊 Monitoring

### Vérifier l'état du système :
```bash
# Lister les utilisateurs non vérifiés
node database/admin_verification_helper.js list

# Tester la configuration email
node database/check_email_config.js
```

### Métriques importantes :
- Nombre d'utilisateurs non vérifiés
- Temps de réponse des emails
- Taux de succès de vérification

## 🔐 Sécurité

### Bonnes pratiques :
1. **Ne jamais partager les codes par SMS non sécurisé**
2. **Vérifier l'identité de l'utilisateur avant d'aider**
3. **Logger toutes les actions d'administration**
4. **Changer régulièrement les mots de passe d'application**

### Audit trail :
Toutes les actions du super admin sont loggées dans la console du serveur.
