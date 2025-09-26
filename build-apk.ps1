# Script PowerShell pour build APK - Presence CCRB
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    BUILD APK - Presence CCRB" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/4] Synchronisation des fichiers web..." -ForegroundColor Yellow
npx cap sync
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR: Synchronisation échouée" -ForegroundColor Red
    Read-Host "Appuyez sur Entrée pour continuer"
    exit 1
}

Write-Host ""
Write-Host "[2/4] Ouverture d'Android Studio..." -ForegroundColor Yellow
npx cap open android
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR: Impossible d'ouvrir Android Studio" -ForegroundColor Red
    Read-Host "Appuyez sur Entrée pour continuer"
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "    INSTRUCTIONS POUR LE BUILD" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "1. Dans Android Studio qui vient de s'ouvrir:" -ForegroundColor White
Write-Host "   - Attendez que le projet se charge complètement" -ForegroundColor Gray
Write-Host "   - Allez dans Build > Build Bundle(s) / APK(s) > Build APK(s)" -ForegroundColor Gray
Write-Host "   - Ou utilisez le raccourci Ctrl+Shift+A puis tapez 'Build APK'" -ForegroundColor Gray
Write-Host ""
Write-Host "2. L'APK sera généré dans:" -ForegroundColor White
Write-Host "   android\app\build\outputs\apk\debug\app-debug.apk" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Pour installer sur un appareil:" -ForegroundColor White
Write-Host "   - Activez le 'Développement USB' sur votre téléphone" -ForegroundColor Gray
Write-Host "   - Connectez le téléphone en USB" -ForegroundColor Gray
Write-Host "   - Cliquez sur 'Run' (triangle vert) dans Android Studio" -ForegroundColor Gray
Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "    FONCTIONNALITÉS NATIVES ACTIVÉES" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "✅ GPS natif haute précision (3-5m)" -ForegroundColor Green
Write-Host "✅ Caméra native" -ForegroundColor Green
Write-Host "✅ Gestion des permissions" -ForegroundColor Green
Write-Host "✅ Stockage local" -ForegroundColor Green
Write-Host "✅ Détection réseau" -ForegroundColor Green
Write-Host "✅ Interface native" -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Read-Host "Appuyez sur Entrée pour continuer"
