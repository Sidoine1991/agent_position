#!/bin/bash

# Script pour créer l'APK Android de Presence CCRB
# Usage: ./build_android.sh

echo "🚀 Création de l'APK Android pour Presence CCRB"

# Vérifier que Node.js est installé
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé"
    exit 1
fi

# Vérifier que npm est installé
if ! command -v npm &> /dev/null; then
    echo "❌ npm n'est pas installé"
    exit 1
fi

# Installer Bubblewrap si pas déjà installé
if ! command -v bubblewrap &> /dev/null; then
    echo "📦 Installation de Bubblewrap..."
    npm install -g @bubblewrap/cli
fi

# Vérifier que Java est installé
if ! command -v java &> /dev/null; then
    echo "❌ Java n'est pas installé. Veuillez installer JDK 17"
    exit 1
fi

echo "✅ Prérequis vérifiés"

# Créer le dossier de build
mkdir -p android-build
cd android-build

# URL de votre application (remplacer par votre vraie URL)
APP_URL="https://votre-domaine.com"

echo "🔧 Initialisation du projet TWA..."
echo "URL de l'application: $APP_URL"

# Initialiser le projet TWA
bubblewrap init \
    --manifest="$APP_URL/manifest.webmanifest" \
    --package-name="com.ccrb.presence" \
    --app-name="Presence CCRB" \
    --launcher-name="Presence CCRB" \
    --app-version="1.0.0" \
    --app-version-code="1" \
    --key-path="./ccrb-key.keystore" \
    --key-alias="ccrb" \
    --key-pass="ccrb123456" \
    --store-pass="ccrb123456"

echo "🔨 Construction de l'APK..."
bubblewrap build

if [ $? -eq 0 ]; then
    echo "✅ APK créé avec succès!"
    echo "📱 Fichier: ./android-build/app-release-signed.apk"
    echo ""
    echo "📋 Prochaines étapes:"
    echo "1. Tester l'APK sur un appareil Android"
    echo "2. Aller sur https://play.google.com/console"
    echo "3. Créer un compte développeur (25$ USD)"
    echo "4. Uploader l'APK et remplir les informations"
    echo "5. Soumettre pour révision"
else
    echo "❌ Erreur lors de la création de l'APK"
    exit 1
fi
