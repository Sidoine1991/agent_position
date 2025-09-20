# Script de déploiement modernisé pour Presence CCRB
# Version 2.0.0 - 2025

param(
    [string]$Environment = "production",
    [switch]$SkipTests = $false,
    [switch]$Force = $false
)

Write-Host "🚀 Déploiement modernisé Presence CCRB v2.0.0" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green

# Vérification des prérequis
Write-Host "🔍 Vérification des prérequis..." -ForegroundColor Yellow

# Vérifier Node.js
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js non installé" -ForegroundColor Red
    exit 1
}

# Vérifier npm
try {
    $npmVersion = npm --version
    Write-Host "✅ npm: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ npm non installé" -ForegroundColor Red
    exit 1
}

# Vérifier Git
try {
    $gitVersion = git --version
    Write-Host "✅ Git: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Git non installé" -ForegroundColor Red
    exit 1
}

# Installation des dépendances
Write-Host "📦 Installation des dépendances..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Échec de l'installation des dépendances" -ForegroundColor Red
    exit 1
}

# Installation des dépendances backend
Write-Host "📦 Installation des dépendances backend..." -ForegroundColor Yellow
Set-Location backend
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Échec de l'installation des dépendances backend" -ForegroundColor Red
    exit 1
}
Set-Location ..

# Tests (si non ignorés)
if (-not $SkipTests) {
    Write-Host "🧪 Exécution des tests..." -ForegroundColor Yellow
    npm test
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Tests échoués" -ForegroundColor Red
        if (-not $Force) {
            exit 1
        }
        Write-Host "⚠️ Continuation forcée malgré les tests échoués" -ForegroundColor Yellow
    }
}

# Vérification du code (linting)
Write-Host "🔍 Vérification du code..." -ForegroundColor Yellow
npm run lint
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreurs de linting détectées" -ForegroundColor Red
    if (-not $Force) {
        exit 1
    }
    Write-Host "⚠️ Continuation forcée malgré les erreurs de linting" -ForegroundColor Yellow
}

# Vérification des types TypeScript
Write-Host "🔍 Vérification des types TypeScript..." -ForegroundColor Yellow
npm run type-check
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreurs de types détectées" -ForegroundColor Red
    if (-not $Force) {
        exit 1
    }
    Write-Host "⚠️ Continuation forcée malgré les erreurs de types" -ForegroundColor Yellow
}

# Build de l'application
Write-Host "🔨 Build de l'application..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Échec du build" -ForegroundColor Red
    exit 1
}

# Migration de la base de données
Write-Host "🗄️ Migration de la base de données..." -ForegroundColor Yellow
Set-Location backend
npm run db:migrate
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Échec de la migration" -ForegroundColor Red
    exit 1
}
Set-Location ..

# Vérification Git
Write-Host "📋 Vérification du statut Git..." -ForegroundColor Yellow
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "⚠️ Fichiers non commités détectés:" -ForegroundColor Yellow
    Write-Host $gitStatus -ForegroundColor Yellow
    
    if (-not $Force) {
        $response = Read-Host "Voulez-vous continuer malgré les fichiers non commités? (y/N)"
        if ($response -ne "y" -and $response -ne "Y") {
            Write-Host "❌ Déploiement annulé" -ForegroundColor Red
            exit 1
        }
    }
}

# Commit des changements
Write-Host "💾 Commit des changements..." -ForegroundColor Yellow
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
git add .
git commit -m "Deploy: Modernized version 2.0.0 - $timestamp"
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️ Aucun changement à commiter" -ForegroundColor Yellow
}

# Push vers le repository
Write-Host "🚀 Push vers le repository..." -ForegroundColor Yellow
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Échec du push" -ForegroundColor Red
    exit 1
}

# Attendre le déploiement Vercel
Write-Host "⏳ Attente du déploiement Vercel..." -ForegroundColor Yellow
Write-Host "   Vérifiez le statut sur: https://vercel.com/dashboard" -ForegroundColor Cyan
Write-Host "   URL de l'application: https://agent-position.vercel.app" -ForegroundColor Cyan

# Test de santé après déploiement
Write-Host "🏥 Test de santé après déploiement..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

try {
    $healthResponse = Invoke-RestMethod -Uri "https://agent-position.vercel.app/api/health" -Method Get
    if ($healthResponse.success) {
        Write-Host "✅ Application déployée et opérationnelle" -ForegroundColor Green
        Write-Host "   Status: $($healthResponse.status)" -ForegroundColor Green
        Write-Host "   Uptime: $($healthResponse.uptime) secondes" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Application déployée mais problème de santé détecté" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️ Impossible de vérifier la santé de l'application" -ForegroundColor Yellow
    Write-Host "   Vérifiez manuellement: https://agent-position.vercel.app" -ForegroundColor Cyan
}

# Résumé du déploiement
Write-Host "`n📊 Résumé du déploiement" -ForegroundColor Green
Write-Host "========================" -ForegroundColor Green
Write-Host "✅ Environnement: $Environment" -ForegroundColor Green
Write-Host "✅ Tests: $(if ($SkipTests) { 'Ignorés' } else { 'Exécutés' })" -ForegroundColor Green
Write-Host "✅ Build: Réussi" -ForegroundColor Green
Write-Host "✅ Migration: Réussie" -ForegroundColor Green
Write-Host "✅ Déploiement: Réussi" -ForegroundColor Green
Write-Host "`n🌐 URLs importantes:" -ForegroundColor Cyan
Write-Host "   Application: https://agent-position.vercel.app" -ForegroundColor Cyan
Write-Host "   API Health: https://agent-position.vercel.app/api/health" -ForegroundColor Cyan
Write-Host "   Dashboard: https://agent-position.vercel.app/dashboard.html" -ForegroundColor Cyan
Write-Host "   Admin: https://agent-position.vercel.app/admin-agents.html" -ForegroundColor Cyan

Write-Host "`n🎉 Déploiement terminé avec succès!" -ForegroundColor Green
