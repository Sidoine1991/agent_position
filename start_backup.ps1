# Presence CCR-B - Script de Sauvegarde Supabase
# PowerShell Version

function Show-Menu {
    Clear-Host
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   PRESENCE CCR-B - SAUVEGARDE SUPABASE" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "[1] Test de connexion" -ForegroundColor Green
    Write-Host "[2] Sauvegarde manuelle" -ForegroundColor Green
    Write-Host "[3] Restaurer depuis la derniere sauvegarde" -ForegroundColor Green
    Write-Host "[4] Lister les sauvegardes" -ForegroundColor Green
    Write-Host "[5] Demarrer la sauvegarde automatique" -ForegroundColor Green
    Write-Host "[6] Quitter" -ForegroundColor Red
    Write-Host ""
}

function Test-Connection {
    Write-Host "Test de connexion..." -ForegroundColor Yellow
    node test_supabase_connection.js
    Read-Host "Appuyez sur Entree pour continuer"
}

function Backup-Manual {
    Write-Host "Sauvegarde en cours..." -ForegroundColor Yellow
    node backup_supabase.js
    Read-Host "Appuyez sur Entree pour continuer"
}

function Restore-Latest {
    Write-Host "Restauration depuis la derniere sauvegarde..." -ForegroundColor Yellow
    node restore_supabase.js restore latest
    Read-Host "Appuyez sur Entree pour continuer"
}

function List-Backups {
    Write-Host "Liste des sauvegardes..." -ForegroundColor Yellow
    node restore_supabase.js list
    Read-Host "Appuyez sur Entree pour continuer"
}

function Start-AutoBackup {
    Write-Host "Demarrage de la sauvegarde automatique..." -ForegroundColor Yellow
    Write-Host "Appuyez sur Ctrl+C pour arreter" -ForegroundColor Red
    node backup_scheduler.js
    Read-Host "Appuyez sur Entree pour continuer"
}

# Boucle principale
do {
    Show-Menu
    $choice = Read-Host "Choisissez une option (1-6)"
    
    switch ($choice) {
        "1" { Test-Connection }
        "2" { Backup-Manual }
        "3" { Restore-Latest }
        "4" { List-Backups }
        "5" { Start-AutoBackup }
        "6" { 
            Write-Host "Au revoir !" -ForegroundColor Green
            exit 
        }
        default { 
            Write-Host "Option invalide. Veuillez choisir entre 1 et 6." -ForegroundColor Red
            Start-Sleep -Seconds 2
        }
    }
} while ($true)
