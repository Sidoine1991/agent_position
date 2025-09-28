# 📱 Presence CCRB - Application Mobile

## 🚀 Génération de l'APK

### Prérequis
- Node.js (v16 ou plus récent)
- Android Studio
- Java JDK 11 ou plus récent

### Étapes de Build

#### Option 1 : Script Automatique (Windows)
```bash
# Exécuter le script de build
.\build-apk.bat
# ou
.\build-apk.ps1
```

#### Option 2 : Commandes Manuelles
```bash
# 1. Synchroniser les fichiers web
npx cap sync

# 2. Ouvrir Android Studio
npx cap open android

# 3. Dans Android Studio :
#    - Build > Build Bundle(s) / APK(s) > Build APK(s)
#    - Ou Ctrl+Shift+A puis "Build APK"
```

### 📍 Localisation de l'APK
L'APK généré se trouve dans :
```
android/app/build/outputs/apk/debug/app-debug.apk
```

## 🔧 Fonctionnalités Natives

### ✅ GPS Haute Précision
- **Précision** : 3-5 mètres (vs 100m+ en web)
- **Accès direct** au GPS hardware
- **Pas de confirmation** nécessaire pour la précision
- **Fonctionne offline** (GPS natif)

### ✅ Caméra Native
- **Accès direct** à la caméra
- **Qualité optimale** des photos
- **Gestion automatique** des permissions

### ✅ Permissions Android
- `ACCESS_FINE_LOCATION` - GPS haute précision
- `ACCESS_COARSE_LOCATION` - GPS approximatif
- `CAMERA` - Accès caméra
- `WRITE_EXTERNAL_STORAGE` - Sauvegarde fichiers
- `INTERNET` - Connexion réseau

### ✅ Interface Native
- **Performance optimale** (pas de navigateur)
- **Animations fluides**
- **Responsive design** adapté mobile
- **Notifications natives**

## 📱 Installation sur Appareil

### Méthode 1 : USB Debugging
1. Activez le "Développement USB" sur votre téléphone
2. Connectez le téléphone en USB
3. Dans Android Studio, cliquez sur "Run" (triangle vert)
4. Sélectionnez votre appareil

### Méthode 2 : APK Direct
1. Copiez l'APK sur votre téléphone
2. Activez "Sources inconnues" dans les paramètres
3. Installez l'APK

## 🔄 Workflow de Développement

### Modifications du Code Web
```bash
# 1. Modifier les fichiers dans /web/
# 2. Synchroniser avec Android
npx cap sync

# 3. Rebuild dans Android Studio
```

### Ajout de Plugins
```bash
# Installer un nouveau plugin
npm install @capacitor/plugin-name

# Synchroniser
npx cap sync
```

## 🐛 Dépannage

### Erreur "SDK not found"
- Installez Android SDK via Android Studio
- Configurez ANDROID_HOME dans les variables d'environnement

### Erreur "Gradle sync failed"
- Ouvrez Android Studio
- File > Sync Project with Gradle Files

### GPS ne fonctionne pas
- Vérifiez les permissions dans les paramètres Android
- Activez la localisation haute précision

### Caméra ne fonctionne pas
- Vérifiez les permissions caméra
- Redémarrez l'application

## 📊 Comparaison Web vs APK

| Fonctionnalité | Web | APK |
|---|---|---|
| Précision GPS | 100m+ | 3-5m |
| Performance | Moyenne | Optimale |
| Offline | Limité | Complet |
| Permissions | Navigateur | Système |
| Installation | URL | APK |
| Mise à jour | Automatique | Manuelle |

## 🎯 Avantages de l'APK

1. **GPS Fiable** : Plus de problème de précision
2. **Performance** : Interface native rapide
3. **Offline** : Fonctionne sans réseau
4. **Sécurité** : Permissions système
5. **UX** : Expérience mobile native

## 📞 Support

Pour toute question ou problème :
- Vérifiez les logs dans Android Studio
- Consultez la documentation Capacitor
- Testez d'abord sur émulateur Android
