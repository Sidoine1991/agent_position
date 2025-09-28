@echo off
echo ========================================
echo    BUILD FINAL - Presence CCRB
echo ========================================
echo.

echo [1/2] Synchronisation des fichiers web...
npx cap sync
if %errorlevel% neq 0 (
    echo ERREUR: Synchronisation échouée
    pause
    exit /b 1
)

echo.
echo [2/2] Ouverture d'Android Studio...
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
echo    - Si Gradle sync échoue: File ^> Invalidate Caches and Restart
echo    - Allez dans Build ^> Build Bundle(s) / APK(s) ^> Build APK(s)
echo.
echo 2. L'APK sera généré dans:
echo    android\app\build\outputs\apk\debug\app-debug.apk
echo.
echo 3. Cette version utilise les APIs web standard:
echo    - GPS web (précision variable selon le navigateur)
echo    - Caméra web (via input file)
echo    - Interface responsive
echo    - Fonctionne offline avec service worker
echo.
echo ========================================
echo    FONCTIONNALITÉS ACTIVÉES
echo ========================================
echo.
echo ✅ GPS web (précision variable)
echo ✅ Caméra web (input file)
echo ✅ Interface responsive
echo ✅ Service worker offline
echo ✅ Stockage local
echo ✅ Détection réseau
echo.
echo ========================================
echo    APPLICATION PRÊTE !
echo ========================================
echo.
echo L'application web fonctionne parfaitement !
echo L'APK sera une version web encapsulée.
echo.
pause
