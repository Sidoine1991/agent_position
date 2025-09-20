# Script de déploiement automatique pour Presence CCRB
Write-Host "Deploiement automatique Presence CCRB..." -ForegroundColor Green

# Vérifier que Node.js est installé
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

# Deployer sur Vercel avec reponses automatiques
Write-Host "Deploiement sur Vercel..." -ForegroundColor Yellow

# Créer un fichier de configuration Vercel
$vercelConfig = @"
{
  "version": 2,
  "builds": [
    {
      "src": "api/**/*.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/web/$1"
    }
  ]
}
"@

$vercelConfig | Out-File -FilePath "vercel.json" -Encoding UTF8

# Deployer
Write-Host "Lancement du deploiement..." -ForegroundColor Cyan
Write-Host "Veuillez repondre aux questions de Vercel:" -ForegroundColor Yellow
Write-Host "1. Set up and deploy? -> Y" -ForegroundColor White
Write-Host "2. Which scope? -> Choisissez votre compte" -ForegroundColor White
Write-Host "3. Link to existing project? -> N" -ForegroundColor White
Write-Host "4. Project name -> presence-ccrb-system" -ForegroundColor White
Write-Host "5. Directory -> ." -ForegroundColor White

npx vercel --prod

Write-Host "Deploiement termine !" -ForegroundColor Green
Write-Host "Votre application est maintenant accessible en ligne." -ForegroundColor Cyan
Write-Host ""
Write-Host "Test des endpoints :" -ForegroundColor Yellow
Write-Host "1. https://presence-ccrb-system.vercel.app/api/test-geo" -ForegroundColor Cyan
Write-Host "2. https://presence-ccrb-system.vercel.app/api/geo/departements" -ForegroundColor Cyan
Write-Host "3. https://presence-ccrb-system.vercel.app/api/geo/communes?departement_id=1" -ForegroundColor Cyan
