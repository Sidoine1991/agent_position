@echo off
REM Script pour créer l'APK Android de Presence CCRB
REM Usage: build_android.bat

echo 🚀 Création de l'APK Android pour Presence CCRB

REM Vérifier que Node.js est installé
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js n'est pas installé
    pause
    exit /b 1
)

REM Vérifier que npm est installé
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm n'est pas installé
    pause
    exit /b 1
)

REM Installer Bubblewrap si pas déjà installé
bubblewrap --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 📦 Installation de Bubblewrap...
    npm install -g @bubblewrap/cli
)

REM Vérifier que Java est installé
java -version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Java n'est pas installé. Veuillez installer JDK 17
    pause
    exit /b 1
)

echo ✅ Prérequis vérifiés

REM Créer le dossier de build
if not exist android-build mkdir android-build
cd android-build

REM URL de votre application (remplacer par votre vraie URL)
set APP_URL=https://votre-domaine.com

echo 🔧 Initialisation du projet TWA...
echo URL de l'application: %APP_URL%

REM Initialiser le projet TWA
bubblewrap init --manifest="%APP_URL%/manifest.webmanifest" --package-name="com.ccrb.presence" --app-name="Presence CCRB" --launcher-name="Presence CCRB" --app-version="1.0.0" --app-version-code="1" --key-path="./ccrb-key.keystore" --key-alias="ccrb" --key-pass="ccrb123456" --store-pass="ccrb123456"

echo 🔨 Construction de l'APK...
bubblewrap build

if %errorlevel% equ 0 (
    echo ✅ APK créé avec succès!
    echo 📱 Fichier: ./android-build/app-release-signed.apk
    echo.
    echo 📋 Prochaines étapes:
    echo 1. Tester l'APK sur un appareil Android
    echo 2. Aller sur https://play.google.com/console
    echo 3. Créer un compte développeur (25$ USD)
    echo 4. Uploader l'APK et remplir les informations
    echo 5. Soumettre pour révision
) else (
    echo ❌ Erreur lors de la création de l'APK
)

pause
