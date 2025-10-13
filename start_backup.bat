@echo off
echo ========================================
echo    PRESENCE CCR-B - SAUVEGARDE SUPABASE
echo ========================================
echo.

echo [1] Test de connexion
echo [2] Sauvegarde manuelle
echo [3] Restaurer depuis la derniere sauvegarde
echo [4] Lister les sauvegardes
echo [5] Demarrer la sauvegarde automatique
echo [6] Quitter
echo.

set /p choice="Choisissez une option (1-6): "

if "%choice%"=="1" (
    echo.
    echo Test de connexion...
    node test_supabase_connection.js
    pause
    goto :start
)

if "%choice%"=="2" (
    echo.
    echo Sauvegarde en cours...
    node backup_supabase.js
    pause
    goto :start
)

if "%choice%"=="3" (
    echo.
    echo Restauration depuis la derniere sauvegarde...
    node restore_supabase.js restore latest
    pause
    goto :start
)

if "%choice%"=="4" (
    echo.
    echo Liste des sauvegardes...
    node restore_supabase.js list
    pause
    goto :start
)

if "%choice%"=="5" (
    echo.
    echo Demarrage de la sauvegarde automatique...
    echo Appuyez sur Ctrl+C pour arreter
    node backup_scheduler.js
    pause
    goto :start
)

if "%choice%"=="6" (
    echo.
    echo Au revoir !
    exit
)

echo.
echo Option invalide. Veuillez choisir entre 1 et 6.
pause
goto :start

:start
cls
goto :eof
