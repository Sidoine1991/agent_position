#!/usr/bin/env node

/**
 * Script de nettoyage final du dépôt
 * Supprime tous les fichiers inutiles et ne garde que l'essentiel
 */

const fs = require('fs');
const path = require('path');

// Arguments CLI
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run') || args.includes('-n');

console.log('🧹 Nettoyage final du dépôt Presence CCRB...\n');
if (isDryRun) {
  console.log('🔎 Mode simulation activé (--dry-run): aucune suppression réelle ne sera effectuée.\n');
}

// Dossiers à supprimer complètement
const dirsToRemove = [
  'android',
  'backend',
  'backend-modern',
  'bootstrap-5.3.8-dist',
  'frontend',
  'scripts',
  'src',
  'supabase',
  'node_modules',
  '.gradle',
  'test-results',
  'tests',
  'database_export',
  'database_export_corrected',
  'database_export_final',
  'database_export_supabase',
  '02_SHP',
  'uploads',
  'apk-build'
];

// Fichiers à supprimer
const filesToRemove = [
  // Fichiers de build APK
  'build-android-studio.bat',
  'build-apk-pwa-builder.js',
  'build-apk-pwa.bat',
  'build-apk-rapide.bat',
  'build-apk.bat',
  'build-apk.ps1',
  'build-final.bat',
  'build-simple.bat',
  'build-web-pure.bat',
  
  // Fichiers de test
  'test-*.js',
  'test-*.html',
  'test-runner.js',
  'test_endpoints_with_auth.js',
  'test_supabase_checkins.js',
  'test-api.js',
  'test-gps-improvements.js',
  'test-mission-end.js',
  'test-navigation.html',
  'test-profile.js',
  'test-user-login.js',
  
  // Fichiers de configuration
  'capacitor.config.json',
  'railway.toml',
  'render.yaml',
  'playwright.config.js',
  'tailwind.config.js',
  'vercel.json',
  'manifest-optimized.json',
  'manifest.json',
  
  // Fichiers de déploiement
  'deploy-pwa-fixes.js',
  'disable-vercel-analytics.js',
  'fix-paths.js',
  'fix-render-paths.js',
  
  // Fichiers de données
  'benin_subdvision.xlsx',
  '~$benin_subdvision.xlsx',
  'gradle-8.11.1-all.zip',
  
  // Fichiers de serveur alternatifs
  'server-db.js',
  'server-render.js',
  'server-simple.js',
  'reports.js',
  'config.js',
  
  // Fichiers de debug
  'debug_dashboard.html',
  'check_database_checkins.js',
  'init-supabase-data.js',
  'generate_final_geo_data.js',
  'update_geo_data.js',
  'update_contract_fields.sql',
  'update_tolerance_radius.sql',
  'verify-agents-columns.sql',
  'add-missing-columns.sql',
  'populate-reports.sql',
  
  // Fichiers de documentation inutiles
  'AMELIORATIONS_FIN_MISSION.md',
  'APK_BUILD_STATUS.md',
  'apk-download-guide.md',
  'CSP_AND_SYNTAX_FIXED.md',
  'CSP_ERRORS_FIXED.md',
  'DASHBOARD_CHECKINS_FIXED.md',
  'DASHBOARD_ENDPOINTS_FIXED.md',
  'DASHBOARD_ERRORS_FIXED.md',
  'DATABASE_RESET_GUIDE.md',
  'DATABASE_SETUP_GUIDE.md',
  'DEPLOYMENT_CHECKLIST.md',
  'DEPLOYMENT_SUMMARY.md',
  'ENVIRONMENT_SETUP.md',
  'GEO_DATA_UPDATE_GUIDE.md',
  'GUIDE_APK_PWA_BUILDER.md',
  'GUIDE_APK.md',
  'IMPROVEMENTS_SUMMARY.md',
  'install-apk-guide.md',
  'PWA_DEPLOYMENT_COMPLETE.md',
  'RATE_LIMITING_FIX.md',
  'README_APK.md',
  'README_RENDER.md',
  'README_SUPABASE_MIGRATION.md',
  'README_TESTS.md',
  'RENDER_DEPLOYMENT_GUIDE.md',
  'REPO_PREPARATION_SUMMARY.md',
  'SECURITY_GUIDE.md',
  'VERCEL_DEPLOYMENT_GUIDE.md',
  'TEST_*.md',
  
  // Fichiers de préparation
  'prepare-repo.js',
  'clean-repo-final.js'
];

// Supprimer les dossiers
console.log('📁 Suppression des dossiers inutiles...');
dirsToRemove.forEach(dir => {
  if (fs.existsSync(dir)) {
    try {
      if (isDryRun) {
        console.log(`  🟡 [dry-run] Supprimer: ${dir}/`);
      } else {
        fs.rmSync(dir, { recursive: true, force: true });
        console.log(`  ✅ Supprimé: ${dir}/`);
      }
    } catch (err) {
      console.log(`  ❌ Erreur: ${dir}/ - ${err.message}`);
    }
  }
});

// Utilitaires glob simples (sans dépendance externe)
const repoRoot = process.cwd().replace(/\\/g, '/');

function listAllFiles(startDir) {
  const entries = fs.readdirSync(startDir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    if (entry.name === '.git') continue; // éviter le dossier git
    const fullPath = path.join(startDir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listAllFiles(fullPath));
    } else if (entry.isFile()) {
      results.push(fullPath.replace(/\\/g, '/'));
    }
  }
  return results;
}

function globToRegExp(pattern) {
  let pat = pattern.replace(/\\/g, '/');
  pat = pat.replace(/[.+^${}()|\\]/g, '\\$&');
  pat = pat.replace(/\*\*/g, '.*');
  pat = pat.replace(/\*/g, '[^/]*');
  pat = pat.replace(/\?/g, '.');
  return new RegExp(`^${pat}$`);
}

function resolveFilePatterns(patterns) {
  const allFiles = listAllFiles(repoRoot);
  const relFiles = allFiles.map(f => f.substring(repoRoot.length + 1));
  const toDelete = new Set();
  for (const pattern of patterns) {
    const hasGlob = /[*?]/.test(pattern) || pattern.includes('**');
    if (!hasGlob) {
      if (fs.existsSync(pattern)) toDelete.add(pattern.replace(/\\/g, '/'));
      continue;
    }
    const regex = globToRegExp(pattern);
    for (const rel of relFiles) {
      if (regex.test(rel)) {
        toDelete.add(rel);
      }
    }
  }
  return Array.from(toDelete);
}

// Supprimer les fichiers (avec support glob)
console.log('\n📄 Suppression des fichiers inutiles...');
const matchedFiles = resolveFilePatterns(filesToRemove);
if (matchedFiles.length === 0) {
  console.log('  ℹ️ Aucun fichier correspondant aux motifs fournis.');
}
matchedFiles.forEach(relPath => {
  const absPath = path.join(repoRoot, relPath);
  if (fs.existsSync(absPath)) {
    try {
      if (isDryRun) {
        console.log(`  🟡 [dry-run] Supprimer: ${relPath}`);
      } else {
        fs.unlinkSync(absPath);
        console.log(`  ✅ Supprimé: ${relPath}`);
      }
    } catch (err) {
      console.log(`  ❌ Erreur: ${relPath} - ${err.message}`);
    }
  }
});

// Vérifier les fichiers essentiels restants
console.log('\n🔍 Vérification des fichiers essentiels...');

const essentialFiles = [
  'README.md',
  'CONTRIBUTING.md',
  'LICENSE',
  'CONTRIBUTORS.md',
  'CHANGELOG.md',
  'SETUP.md',
  'package.json',
  '.gitignore',
  'env.example',
  'server.js',
  'web/',
  'api/',
  'database/',
  'Media/'
];

essentialFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`  ✅ Présent: ${file}`);
  } else {
    console.log(`  ❌ Manquant: ${file}`);
  }
});

console.log('\n🎉 Nettoyage terminé !');
console.log('\n📋 Structure finale du dépôt :');
console.log('├── web/                    # Interface utilisateur');
console.log('├── api/                    # API endpoints');
console.log('├── database/               # Scripts de base de données');
console.log('├── Media/                  # Images et assets');
console.log('├── server.js               # Serveur principal');
console.log('├── package.json            # Configuration Node.js');
console.log('├── README.md               # Documentation principale');
console.log('├── CONTRIBUTING.md         # Guide des contributeurs');
console.log('├── SETUP.md               # Guide d\'installation');
console.log('├── LICENSE                # Licence MIT');
console.log('├── .gitignore             # Exclusions Git');
console.log('└── env.example            # Template de configuration');
console.log('\n🚀 Le dépôt est maintenant prêt pour la contribution !');
if (isDryRun) {
  console.log('\nℹ️ Aucune suppression réelle n\'a été effectuée (mode dry-run).');
}
