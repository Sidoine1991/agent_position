@echo off
echo ========================================
echo   BUILD APK PWA BUILDER - Presence CCRB
echo ========================================
echo.

echo [1/3] Verification de l'URL PWA...
echo URL: https://agent-position.vercel.app
echo.

echo [2/3] Ouverture de PWA Builder...
echo.
echo 🌐 Ouverture de https://www.pwabuilder.com/
echo 📝 Entrer l'URL: https://agent-position.vercel.app
echo 🔍 Cliquer sur "Start"
echo.

start https://www.pwabuilder.com/

echo [3/3] Instructions de construction...
echo.
echo 📋 ETAPES SUIVANTES:
echo.
echo 1. 🌐 PWA Builder s'ouvre dans votre navigateur
echo 2. 📝 Entrer l'URL: https://agent-position.vercel.app
echo 3. 🔍 Cliquer sur "Start" pour analyser
echo 4. ✅ Verifier que tous les scores sont verts
echo 5. 📱 Cliquer sur "Build My PWA"
echo 6. 🤖 Selectionner "Android"
echo 7. ⚙️ Configurer:
echo    - Package Name: com.ccrb.presence
echo    - App Name: Presence CCRB
echo    - Version: 1.0.0
echo 8. 📥 Telecharger l'APK genere
echo 9. 📁 Sauvegarder dans: %cd%\apk-build\
echo.

echo 🎯 Votre PWA est prete pour PWA Builder!
echo.
echo 📱 Fonctionnalites disponibles:
echo    ✅ Authentification securisee
echo    ✅ Geolocalisation GPS
echo    ✅ Marquage de presence
echo    ✅ Historique des missions
echo    ✅ Interface responsive
echo    ✅ Mode hors ligne
echo.

echo 🚀 Allez sur PWA Builder pour construire votre APK!
echo.

pause
