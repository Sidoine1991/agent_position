#!/bin/bash

# Script de déploiement simplifié pour Presence CCRB
echo "🚀 Déploiement simplifié Presence CCRB..."

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

# Vérifier que Vercel CLI est installé
if ! command -v vercel &> /dev/null; then
    echo "📥 Installation de Vercel CLI..."
    npm install -g vercel
fi

# Déployer sur Vercel avec la configuration simple
echo "🌐 Déploiement sur Vercel..."
vercel --prod --config vercel-simple.json

echo "✅ Déploiement terminé !"
echo "🔗 Votre application est maintenant accessible en ligne."
echo ""
echo "🧪 Test des endpoints :"
echo "1. https://presence-ccrb-system.vercel.app/api/test-geo"
echo "2. https://presence-ccrb-system.vercel.app/api/geo/departements"
echo "3. https://presence-ccrb-system.vercel.app/api/init-geo-data"
