@echo off
REM Script principal pour gérer les sauvegardes Supabase
REM Usage: backup_manager.bat [backup|restore|list]

setlocal enabledelayedexpansion

set BACKUP_DIR=.\backups
set SCRIPT_DIR=.\scripts

:show_help
if "%1"=="help" goto :help
if "%1"=="-h" goto :help
if "%1"=="--help" goto :help
if "%1"=="" goto :help

:check_node
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js n'est pas installé
    exit /b 1
)

REM Créer le dossier de sauvegarde s'il n'existe pas
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

:process_command
if "%1"=="backup" goto :create_backup
if "%1"=="restore" goto :restore_backup
if "%1"=="list" goto :list_backups
goto :unknown_command

:create_backup
echo 🚀 Création d'une nouvelle sauvegarde...
if not exist "%SCRIPT_DIR%\backup_supabase.js" (
    echo ❌ Script de sauvegarde non trouvé
    exit /b 1
)
node "%SCRIPT_DIR%\backup_supabase.js"
if %errorlevel% equ 0 (
    echo ✅ Sauvegarde créée avec succès!
) else (
    echo ❌ Erreur lors de la création de la sauvegarde
    exit /b 1
)
goto :end

:restore_backup
set backup_file=%2
if "%backup_file%"=="" (
    echo 📋 Veuillez spécifier le fichier de sauvegarde à restaurer
    echo.
    echo Sauvegardes disponibles:
    node "%SCRIPT_DIR%\list_backups.js"
    echo.
    echo Usage: %0 restore ^<fichier_de_sauvegarde^>
    exit /b 1
)
if not exist "%backup_file%" (
    echo ❌ Fichier de sauvegarde non trouvé: %backup_file%
    exit /b 1
)
echo ⚠️ ATTENTION: Cette opération va supprimer toutes les données existantes!
echo ⚠️ Fichier de restauration: %backup_file%
echo.
set /p confirm="Êtes-vous sûr de vouloir continuer? (oui/non): "
if /i "%confirm%"=="oui" goto :do_restore
if /i "%confirm%"=="o" goto :do_restore
if /i "%confirm%"=="yes" goto :do_restore
if /i "%confirm%"=="y" goto :do_restore
echo ❌ Restauration annulée
exit /b 0

:do_restore
echo 🔄 Restauration en cours...
node "%SCRIPT_DIR%\restore_backup.js" "%backup_file%" --force
if %errorlevel% equ 0 (
    echo ✅ Restauration terminée avec succès!
) else (
    echo ❌ Erreur lors de la restauration
    exit /b 1
)
goto :end

:list_backups
echo 📋 Liste des sauvegardes disponibles:
node "%SCRIPT_DIR%\list_backups.js"
goto :end

:unknown_command
echo ❌ Commande inconnue: %1
echo.
goto :help

:help
echo 📁 Gestionnaire de sauvegardes Supabase
echo ======================================
echo.
echo Usage: %0 [commande]
echo.
echo Commandes disponibles:
echo   backup   - Créer une nouvelle sauvegarde
echo   restore  - Restaurer une sauvegarde
echo   list     - Lister les sauvegardes disponibles
echo   help     - Afficher cette aide
echo.
echo Exemples:
echo   %0 backup
echo   %0 list
echo   %0 restore backups\supabase_backup_2024-01-15T10-30-00.json
goto :end

:end
endlocal
