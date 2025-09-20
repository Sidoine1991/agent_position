# 🚀 Guide de Déploiement - Presence CCRB

## ✅ Problème résolu !

Les endpoints géographiques ont été créés avec la **vraie hiérarchie** du fichier Excel :
- **Départements** → **Communes** → **Arrondissements** → **Villages**

## 📁 Fichiers créés

- `api/geo-data.js` - Données géographiques complètes du Bénin
- `api/geo/departements.js` - 10 départements
- `api/geo/communes.js` - Communes par département
- `api/geo/arrondissements.js` - Arrondissements par commune
- `api/geo/villages.js` - Villages par arrondissement

## 🚀 Déploiement

### Option 1 : Déploiement automatique
```powershell
.\deploy-auto.ps1
```

### Option 2 : Déploiement manuel
1. **Installer Vercel CLI** :
   ```bash
   npm install -g vercel
   ```

2. **Déployer** :
   ```bash
   npx vercel --prod
   ```

3. **Répondre aux questions** :
   - Set up and deploy? → **Y**
   - Which scope? → Choisir votre compte
   - Link to existing project? → **N**
   - Project name → **presence-ccrb-system**
   - Directory → **.**

## 🧪 Test des endpoints

Après déploiement, testez :

1. **Test de base** :
   ```
   https://presence-ccrb-system.vercel.app/api/test-geo
   ```

2. **Départements** :
   ```
   https://presence-ccrb-system.vercel.app/api/geo/departements
   ```

3. **Communes** (ex: département ID 1) :
   ```
   https://presence-ccrb-system.vercel.app/api/geo/communes?departement_id=1
   ```

4. **Arrondissements** (ex: commune ID 1) :
   ```
   https://presence-ccrb-system.vercel.app/api/geo/arrondissements?commune_id=1
   ```

5. **Villages** (ex: arrondissement ID 1) :
   ```
   https://presence-ccrb-system.vercel.app/api/geo/villages?arrondissement_id=1
   ```

## 📊 Données disponibles

- **10 départements** du Bénin
- **75 communes** réparties par département
- **546 arrondissements** répartis par commune
- **5289 villages** répartis par arrondissement

## ✅ Résultat attendu

Après déploiement, votre application à l'adresse [https://presence-ccrb-system.vercel.app/](https://presence-ccrb-system.vercel.app/) devrait correctement afficher la hiérarchie administrative du Bénin dans les formulaires d'inscription et de gestion des agents.

## 🔧 Configuration Vercel

Le fichier `vercel.json` est configuré pour :
- Router les requêtes `/api/*` vers les fonctions serverless
- Router les autres requêtes vers le dossier `web/`
- Utiliser Node.js 18.x pour les fonctions API
