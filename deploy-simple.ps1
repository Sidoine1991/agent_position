# Script de déploiement PowerShell pour Presence CCRB
Write-Host "Deploiement simplifie Presence CCRB..." -ForegroundColor Green

# Verifier que Node.js est installe
try {
    $nodeVersion = node --version
    Write-Host "Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "Node.js n'est pas installe. Veuillez l'installer d'abord." -ForegroundColor Red
    exit 1
}

# Installer les dependances de l'API
Write-Host "Installation des dependances API..." -ForegroundColor Yellow
Set-Location api
npm install
Set-Location ..

# Verifier que Vercel CLI est installe
try {
    $vercelVersion = vercel --version
    Write-Host "Vercel CLI version: $vercelVersion" -ForegroundColor Green
} catch {
    Write-Host "Installation de Vercel CLI..." -ForegroundColor Yellow
    npm install -g vercel
}

# Deployer sur Vercel avec la configuration simple
Write-Host "Deploiement sur Vercel..." -ForegroundColor Yellow
vercel --prod --config vercel-simple.json

Write-Host "Deploiement termine !" -ForegroundColor Green
Write-Host "Votre application est maintenant accessible en ligne." -ForegroundColor Cyan
Write-Host ""
Write-Host "Test des endpoints :" -ForegroundColor Yellow
Write-Host "1. https://presence-ccrb-system.vercel.app/api/test-geo" -ForegroundColor Cyan
Write-Host "2. https://presence-ccrb-system.vercel.app/api/geo/departements" -ForegroundColor Cyan
Write-Host "3. https://presence-ccrb-system.vercel.app/api/init-geo-data" -ForegroundColor Cyan