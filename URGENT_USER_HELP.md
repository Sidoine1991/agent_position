# 🚨 Aide Urgente - Utilisateurs Bloqués par les Codes de Vérification

## 📊 Situation Actuelle
D'après la base de données Supabase, il y a des utilisateurs avec des codes de vérification qui ne peuvent pas se connecter car les emails ne sont pas envoyés.

### Utilisateurs identifiés :
- **ID 27** : Code `261100` (expire le 11/10/2025)
- **ID 29** : Code `942974` (expire le 12/10/2025)

## 🛠️ Solutions Immédiates

### Option 1 : Vérification Manuelle (Recommandée)
Pour chaque utilisateur bloqué, contactez-le et donnez-lui son code :

**Pour l'utilisateur ID 27 :**
- Code : `261100`
- Contactez l'utilisateur et donnez-lui ce code

**Pour l'utilisateur ID 29 :**
- Code : `942974`
- Contactez l'utilisateur et donnez-lui ce code

### Option 2 : Vérification Automatique
Utilisez le script pour vérifier automatiquement les utilisateurs :

```bash
# Vérifier l'utilisateur ID 27
node database/help_blocked_users.js verify email@utilisateur27.com

# Vérifier l'utilisateur ID 29
node database/help_blocked_users.js verify email@utilisateur29.com
```

### Option 3 : Générer de Nouveaux Codes
Si les codes sont expirés, générez-en de nouveaux :

```bash
# Générer un nouveau code pour l'utilisateur
node database/help_blocked_users.js generate email@utilisateur.com
```

## 📞 Contact Super Admin
- **Email** : syebadokpo@gmail.com
- **Téléphone** : +229 01 96 91 13 46

## 🔧 Scripts Disponibles

### 1. Lister tous les utilisateurs bloqués
```bash
node database/help_blocked_users.js list
```

### 2. Générer un nouveau code
```bash
node database/help_blocked_users.js generate email@utilisateur.com
```

### 3. Vérifier manuellement
```bash
node database/help_blocked_users.js verify email@utilisateur.com
```

## 🚨 Solution d'Urgence (Si nécessaire)
Si vous voulez permettre l'accès immédiat à tous les utilisateurs :

1. Allez dans la console Supabase
2. Exécutez ce SQL :
```sql
UPDATE users 
SET is_verified = true, verification_code = NULL, verification_expires = NULL
WHERE is_verified = false;
```

## 📋 Procédure Recommandée

1. **Identifiez les utilisateurs bloqués** avec le script
2. **Contactez chaque utilisateur** par email ou téléphone
3. **Donnez-leur leur code** ou vérifiez-les manuellement
4. **Configurez l'email** pour éviter le problème à l'avenir
5. **Testez la configuration** avec le script de test

## 🔍 Diagnostic
Pour diagnostiquer le problème d'email :
```bash
node database/check_email_config.js
```

## 📚 Guides Disponibles
- `GMAIL_SETUP_GUIDE.md` - Configuration Gmail
- `SUPER_ADMIN_GUIDE.md` - Guide complet du super admin
- `database/cleanup_verification_codes.sql` - Nettoyage des codes
