#!/bin/bash

# Script de correction du déploiement pour Presence CCRB
echo "🔧 Correction du déploiement Presence CCRB..."

# Vérifier que Node.js est installé
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé. Veuillez l'installer d'abord."
    exit 1
fi

# Installer les dépendances de l'API
echo "📦 Installation des dépendances API..."
cd api
npm install
cd ..

# Construire le backend
echo "🔨 Construction du backend..."
cd backend
npm install
npm run build
cd ..

# Vérifier que Vercel CLI est installé
if ! command -v vercel &> /dev/null; then
    echo "📥 Installation de Vercel CLI..."
    npm install -g vercel
fi

# Déployer sur Vercel
echo "🌐 Déploiement sur Vercel..."
vercel --prod

echo "✅ Déploiement corrigé !"
echo "🔗 Votre application est maintenant accessible en ligne."
echo "📊 Les endpoints géographiques sont maintenant disponibles."
echo ""
echo "🚀 Prochaines étapes :"
echo "1. Visitez https://presence-ccrb-system.vercel.app/api/init-geo-data"
echo "2. Attendez que les données géographiques soient initialisées"
echo "3. Testez l'affichage des départements dans l'interface"
