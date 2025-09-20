#!/bin/bash

# Script de déploiement automatisé pour Presence CCRB
echo "🚀 Déploiement de Presence CCRB..."

# Vérifier que Node.js est installé
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé. Veuillez l'installer d'abord."
    exit 1
fi

# Vérifier que Git est configuré
if ! git config user.name &> /dev/null; then
    echo "❌ Git n'est pas configuré. Veuillez configurer votre nom et email."
    exit 1
fi

# Installer les dépendances
echo "📦 Installation des dépendances..."
npm install

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

echo "✅ Déploiement terminé !"
echo "🔗 Votre application est maintenant accessible en ligne."
echo "📊 Consultez le dashboard Vercel pour les statistiques."
