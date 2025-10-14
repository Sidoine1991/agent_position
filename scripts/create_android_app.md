# Guide pour créer l'APK Android

## 1. Installer les prérequis

### Java Development Kit (JDK) 17
- Télécharger depuis: https://adoptium.net/
- Installer et configurer JAVA_HOME

### Android Studio
- Télécharger depuis: https://developer.android.com/studio
- Installer Android SDK

### Node.js et npm
- Déjà installé sur votre système

## 2. Créer l'APK avec Bubblewrap

```bash
# Installer Bubblewrap globalement
npm install -g @bubblewrap/cli

# Initialiser le projet TWA
bubblewrap init --manifest=https://votre-domaine.com/manifest.webmanifest

# Suivre les instructions pour:
# - Package name: com.ccrb.presence
# - App name: Presence CCRB
# - Launcher name: Presence CCRB
# - App version: 1.0.0
# - App version code: 1
# - Signing key: Créer une nouvelle clé

# Générer l'APK
bubblewrap build

# L'APK sera généré dans le dossier ./app-release-signed.apk
```

## 3. Alternative: Utiliser PWA Builder

1. Aller sur https://www.pwabuilder.com/
2. Entrer l'URL de votre PWA
3. Cliquer sur "Build My PWA"
4. Sélectionner "Android" et "Google Play Store"
5. Télécharger le package Android

## 4. Tester l'APK

```bash
# Installer sur un appareil Android
adb install app-release-signed.apk

# Ou utiliser Android Studio pour tester
```

## 5. Publier sur Google Play Store

1. Aller sur https://play.google.com/console
2. Créer un compte développeur (25$ USD)
3. Créer une nouvelle application
4. Uploader l'APK
5. Remplir les informations de l'app
6. Soumettre pour révision
