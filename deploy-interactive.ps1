# Script de déploiement interactif pour Presence CCRB
Write-Host "Deploiement interactif Presence CCRB..." -ForegroundColor Green

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

# Créer un fichier de configuration Vercel simple
$vercelConfig = @"
{
  "version": 2,
  "functions": {
    "api/**/*.js": {
      "runtime": "nodejs18.x"
    }
  },
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

Write-Host "Configuration Vercel creee." -ForegroundColor Green

# Deployer
Write-Host "Lancement du deploiement..." -ForegroundColor Cyan
Write-Host ""
Write-Host "INSTRUCTIONS POUR VERCEL:" -ForegroundColor Yellow
Write-Host "1. Set up and deploy? -> Tapez 'Y' et appuyez sur Entree" -ForegroundColor White
Write-Host "2. Which scope? -> Choisissez votre compte (utilisez les fleches et Entree)" -ForegroundColor White
Write-Host "3. Link to existing project? -> Tapez 'N' et appuyez sur Entree" -ForegroundColor White
Write-Host "4. Project name -> Tapez 'presence-ccrb-system' et appuyez sur Entree" -ForegroundColor White
Write-Host "5. Directory -> Appuyez simplement sur Entree (repertoire courant)" -ForegroundColor White
Write-Host ""

# Lancer Vercel
npx vercel --prod

Write-Host ""
Write-Host "Deploiement termine !" -ForegroundColor Green
Write-Host "Votre application est maintenant accessible en ligne." -ForegroundColor Cyan
Write-Host ""
Write-Host "Test des endpoints :" -ForegroundColor Yellow
Write-Host "1. https://presence-ccrb-system.vercel.app/api/test-geo" -ForegroundColor Cyan
Write-Host "2. https://presence-ccrb-system.vercel.app/api/geo/departements" -ForegroundColor Cyan
Write-Host "3. https://presence-ccrb-system.vercel.app/api/geo/communes?departement_id=1" -ForegroundColor Cyan
Write-Host "4. https://presence-ccrb-system.vercel.app/api/geo/arrondissements?commune_id=1" -ForegroundColor Cyan
Write-Host "5. https://presence-ccrb-system.vercel.app/api/geo/villages?arrondissement_id=1" -ForegroundColor Cyan
