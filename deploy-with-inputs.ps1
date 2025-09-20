# Script de déploiement avec entrées automatiques
Write-Host "Deploiement avec entrees automatiques..." -ForegroundColor Green

# Créer un fichier d'entrées pour Vercel
$inputs = @"
Y
presence-ccrb-system
N
.
"@

$inputs | Out-File -FilePath "vercel-inputs.txt" -Encoding UTF8

Write-Host "Fichier d'entrees cree." -ForegroundColor Green

# Lancer Vercel avec les entrées automatiques
Write-Host "Lancement du deploiement..." -ForegroundColor Cyan

# Utiliser Get-Content pour lire les entrées et les passer à Vercel
Get-Content "vercel-inputs.txt" | npx vercel --prod

Write-Host ""
Write-Host "Deploiement termine !" -ForegroundColor Green
Write-Host "Votre application est maintenant accessible en ligne." -ForegroundColor Cyan

# Nettoyer le fichier temporaire
Remove-Item "vercel-inputs.txt" -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Test des endpoints :" -ForegroundColor Yellow
Write-Host "1. https://presence-ccrb-system.vercel.app/api/test-geo" -ForegroundColor Cyan
Write-Host "2. https://presence-ccrb-system.vercel.app/api/geo/departements" -ForegroundColor Cyan
Write-Host "3. https://presence-ccrb-system.vercel.app/api/geo/communes?departement_id=1" -ForegroundColor Cyan
Write-Host "4. https://presence-ccrb-system.vercel.app/api/geo/arrondissements?commune_id=1" -ForegroundColor Cyan
Write-Host "5. https://presence-ccrb-system.vercel.app/api/geo/villages?arrondissement_id=1" -ForegroundColor Cyan
