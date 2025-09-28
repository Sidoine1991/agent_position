@echo off
echo ========================================
echo    BUILD APK - Presence CCRB
echo ========================================
echo.

echo [1/3] Synchronisation des fichiers web...
npx cap sync
if %errorlevel% neq 0 (
    echo ERREUR: Synchronisation échouée
    pause
    exit /b 1
)

echo.
echo [2/3] Ouverture d'Android Studio...
npx cap open android
if %errorlevel% neq 0 (
    echo ERREUR: Impossible d'ouvrir Android Studio
    pause
    exit /b 1
)

echo.
echo ========================================
echo    INSTRUCTIONS POUR LE BUILD
echo ========================================
echo.
echo 1. Dans Android Studio qui vient de s'ouvrir:
echo    - Attendez que le projet se charge complètement
echo    - Allez dans Build ^> Build Bundle(s) / APK(s) ^> Build APK(s)
echo    - Ou utilisez le raccourci Ctrl+Shift+A puis tapez "Build APK"
echo.
echo 2. L'APK sera généré dans:
echo    android\app\build\outputs\apk\debug\app-debug.apk
echo.
echo 3. Pour installer sur un appareil:
echo    - Activez le "Développement USB" sur votre téléphone
echo    - Connectez le téléphone en USB
echo    - Cliquez sur "Run" (triangle vert) dans Android Studio
echo.
echo ========================================
echo    FONCTIONNALITÉS NATIVES ACTIVÉES
echo ========================================
echo.
echo ✅ GPS natif haute précision (3-5m)
echo ✅ Caméra native
echo ✅ Gestion des permissions
echo ✅ Stockage local
echo ✅ Détection réseau
echo ✅ Interface native
echo.
echo ========================================
pause
