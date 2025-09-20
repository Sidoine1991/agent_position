# Script de déploiement avec correction des endpoints géographiques
Write-Host "🚀 Déploiement de l'application CCRB avec correction géographique..." -ForegroundColor Green

# 1. Commit et push des changements
Write-Host "📝 Commit des changements..." -ForegroundColor Yellow
git add .
git commit -m "Fix: Correction des endpoints géographiques pour Vercel"
git push origin main

# 2. Attendre le déploiement automatique
Write-Host "⏳ Attente du déploiement automatique (30 secondes)..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# 3. Obtenir la dernière URL de production
Write-Host "🔍 Récupération de l'URL de production..." -ForegroundColor Yellow
$vercelOutput = npx vercel ls 2>&1
$productionUrl = ""

if ($vercelOutput -match "https://presenceccrb-\w+-yebadokpo-sidoines-projects\.vercel\.app.*Ready") {
    $matches = [regex]::Matches($vercelOutput, "https://presenceccrb-\w+-yebadokpo-sidoines-projects\.vercel\.app")
    if ($matches.Count -gt 0) {
        $productionUrl = $matches[0].Value
        Write-Host "✅ URL de production trouvée: $productionUrl" -ForegroundColor Green
    }
}

if (-not $productionUrl) {
    Write-Host "❌ Impossible de trouver l'URL de production" -ForegroundColor Red
    Write-Host "🔧 Utilisation de l'URL par défaut..." -ForegroundColor Yellow
    $productionUrl = "https://presence-ccrb-system.vercel.app"
}

# 4. Tester l'API
Write-Host "🧪 Test de l'API géographique..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$productionUrl/api/geo/departements" -Method GET -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ API géographique fonctionne !" -ForegroundColor Green
    } else {
        Write-Host "⚠️ API géographique répond avec le code: $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Erreur lors du test de l'API: $($_.Exception.Message)" -ForegroundColor Red
}

# 5. Afficher les informations
Write-Host "`n🎉 Déploiement terminé !" -ForegroundColor Green
Write-Host "🌐 Application: $productionUrl" -ForegroundColor Cyan
Write-Host "🔧 API Health: $productionUrl/api/health" -ForegroundColor Cyan
Write-Host "🗺️ API Départements: $productionUrl/api/geo/departements" -ForegroundColor Cyan
Write-Host "`n📋 Instructions:" -ForegroundColor Yellow
Write-Host "1. Ouvrez l'application dans votre navigateur" -ForegroundColor White
Write-Host "2. Connectez-vous avec admin@ccrb.local / 123456" -ForegroundColor White
Write-Host "3. Testez les sélecteurs géographiques" -ForegroundColor White
Write-Host "4. Si les sélecteurs sont toujours désactivés, attendez 1-2 minutes pour la propagation" -ForegroundColor White
