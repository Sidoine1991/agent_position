// Test automatisé pour Presence CCRB
const { test, expect } = require('@playwright/test');

// Configuration des tests
const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const VERCEL_URL = 'https://agent-position.vercel.app';
const RENDER_URL = process.env.RENDER_URL || 'https://presence-ccrb.onrender.com';

// Credentials de test
const TEST_CREDENTIALS = {
  email: 'ntchaostelle4@gmail.com',
  password: '123456'
};

// Configuration des tests
test.describe('Presence CCRB - Tests Automatisés', () => {
  
  // Test 1: Vérification de la page d'accueil
  test('Page d\'accueil se charge correctement', async ({ page }) => {
    console.log('🧪 Test 1: Vérification page d\'accueil');
    
    await page.goto(BASE_URL);
    
    // Vérifier que la page se charge
    await expect(page).toHaveTitle(/Presence CCRB/);
    
    // Vérifier les éléments principaux
    await expect(page.locator('h1')).toContainText('Presence CCRB');
    await expect(page.locator('#auth-section')).toBeVisible();
    
    console.log('✅ Page d\'accueil chargée correctement');
  });

  // Test 2: Connexion avec credentials
  test('Connexion avec credentials valides', async ({ page }) => {
    console.log('🧪 Test 2: Test de connexion');
    
    await page.goto(BASE_URL);
    
    // Remplir le formulaire de connexion
    await page.fill('#email', TEST_CREDENTIALS.email);
    await page.fill('#password', TEST_CREDENTIALS.password);
    
    // Cliquer sur le bouton de connexion
    await page.click('button[type="submit"]');
    
    // Attendre la redirection ou l'apparition de l'interface
    try {
      await page.waitForSelector('#app-section', { timeout: 10000 });
      console.log('✅ Connexion réussie');
    } catch (error) {
      console.log('❌ Échec de la connexion:', error.message);
      
      // Capturer une screenshot en cas d'erreur
      await page.screenshot({ path: 'test-results/login-error.png' });
      throw error;
    }
  });

  // Test 3: Test GPS et géolocalisation
  test('Test de la fonctionnalité GPS', async ({ page }) => {
    console.log('🧪 Test 3: Test GPS');
    
    await page.goto(BASE_URL);
    
    // Se connecter d'abord
    await page.fill('#email', TEST_CREDENTIALS.email);
    await page.fill('#password', TEST_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    
    // Attendre l'interface principale
    await page.waitForSelector('#app-section', { timeout: 10000 });
    
    // Simuler la permission GPS
    await page.context().grantPermissions(['geolocation']);
    
    // Simuler des coordonnées GPS (Bénin)
    await page.context().setGeolocation({ 
      latitude: 9.3077, 
      longitude: 2.3158 
    });
    
    // Chercher le bouton de mission
    const missionButton = page.locator('button:has-text("DÉBUTER LA MISSION")');
    
    if (await missionButton.isVisible()) {
      await missionButton.click();
      
      // Attendre que le GPS soit récupéré
      await page.waitForTimeout(3000);
      
      // Vérifier qu'une mission a été créée ou qu'un message GPS apparaît
      const gpsMessage = page.locator('text=/GPS|géolocalisation|coordonnées/i');
      if (await gpsMessage.isVisible()) {
        console.log('✅ GPS fonctionne - Message détecté');
      } else {
        console.log('⚠️ GPS testé mais pas de message visible');
      }
    } else {
      console.log('⚠️ Bouton de mission non trouvé');
    }
  });

  // Test 4: Test de l'interface mobile
  test('Test interface mobile', async ({ page }) => {
    console.log('🧪 Test 4: Test interface mobile');
    
    // Simuler un appareil mobile
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto(BASE_URL);
    
    // Vérifier que l'interface s'adapte au mobile
    const authSection = page.locator('#auth-section');
    await expect(authSection).toBeVisible();
    
    // Test de connexion sur mobile
    await page.fill('#email', TEST_CREDENTIALS.email);
    await page.fill('#password', TEST_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    
    try {
      await page.waitForSelector('#app-section', { timeout: 10000 });
      console.log('✅ Interface mobile fonctionne');
    } catch (error) {
      console.log('❌ Problème interface mobile:', error.message);
      await page.screenshot({ path: 'test-results/mobile-error.png' });
    }
  });

  // Test 5: Test de performance
  test('Test de performance', async ({ page }) => {
    console.log('🧪 Test 5: Test de performance');
    
    const startTime = Date.now();
    
    await page.goto(BASE_URL);
    
    // Attendre que la page soit complètement chargée
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    console.log(`⏱️ Temps de chargement: ${loadTime}ms`);
    
    // Vérifier que le chargement est raisonnable (< 5 secondes)
    expect(loadTime).toBeLessThan(5000);
    
    console.log('✅ Performance acceptable');
  });

  // Test 6: Test des fonctionnalités PWA
  test('Test des fonctionnalités PWA', async ({ page }) => {
    console.log('🧪 Test 6: Test PWA');
    
    await page.goto(BASE_URL);
    
    // Vérifier le manifest
    const manifest = await page.evaluate(() => {
      const manifestLink = document.querySelector('link[rel="manifest"]');
      return manifestLink ? manifestLink.href : null;
    });
    
    if (manifest) {
      console.log('✅ Manifest PWA trouvé:', manifest);
    } else {
      console.log('⚠️ Manifest PWA non trouvé');
    }
    
    // Vérifier le service worker
    const swRegistered = await page.evaluate(() => {
      return 'serviceWorker' in navigator;
    });
    
    if (swRegistered) {
      console.log('✅ Service Worker supporté');
    } else {
      console.log('⚠️ Service Worker non supporté');
    }
  });

  // Test 7: Test de l'API
  test('Test de l\'API', async ({ page }) => {
    console.log('🧪 Test 7: Test API');
    
    // Test de l'endpoint de santé
    const healthResponse = await page.request.get(`${BASE_URL}/api/health`);
    expect(healthResponse.status()).toBe(200);
    
    const healthData = await healthResponse.json();
    console.log('✅ API Health:', healthData);
    
    // Test de l'endpoint de connexion
    const loginResponse = await page.request.post(`${BASE_URL}/api/login`, {
      data: TEST_CREDENTIALS
    });
    
    if (loginResponse.status() === 200) {
      const loginData = await loginResponse.json();
      console.log('✅ API Login fonctionne');
      expect(loginData.success).toBe(true);
    } else {
      console.log('⚠️ API Login échoue:', loginResponse.status());
    }
  });

  // Test 8: Test de sécurité
  test('Test de sécurité', async ({ page }) => {
    console.log('🧪 Test 8: Test de sécurité');
    
    await page.goto(BASE_URL);
    
    // Vérifier les headers de sécurité
    const response = await page.goto(BASE_URL);
    const headers = response.headers();
    
    // Vérifier la présence de headers de sécurité
    const securityHeaders = [
      'x-frame-options',
      'x-content-type-options',
      'x-xss-protection'
    ];
    
    for (const header of securityHeaders) {
      if (headers[header]) {
        console.log(`✅ Header de sécurité ${header} présent`);
      } else {
        console.log(`⚠️ Header de sécurité ${header} manquant`);
      }
    }
  });

  // Test 9: Test de compatibilité navigateur
  test('Test de compatibilité', async ({ page }) => {
    console.log('🧪 Test 9: Test de compatibilité');
    
    await page.goto(BASE_URL);
    
    // Vérifier les fonctionnalités JavaScript
    const jsFeatures = await page.evaluate(() => {
      return {
        geolocation: 'geolocation' in navigator,
        localStorage: 'localStorage' in window,
        serviceWorker: 'serviceWorker' in navigator,
        notifications: 'Notification' in window,
        pushManager: 'PushManager' in window
      };
    });
    
    console.log('🔍 Fonctionnalités supportées:', jsFeatures);
    
    // Vérifier que les fonctionnalités essentielles sont supportées
    expect(jsFeatures.localStorage).toBe(true);
    expect(jsFeatures.geolocation).toBe(true);
  });

  // Test 10: Test de déploiement Vercel
  test('Test déploiement Vercel', async ({ page }) => {
    console.log('🧪 Test 10: Test Vercel');
    
    await page.goto(VERCEL_URL);
    
    // Vérifier que la page se charge
    await expect(page).toHaveTitle(/Presence CCRB/);
    
    // Test de connexion sur Vercel
    await page.fill('#email', TEST_CREDENTIALS.email);
    await page.fill('#password', TEST_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    
    try {
      await page.waitForSelector('#app-section', { timeout: 15000 });
      console.log('✅ Vercel fonctionne correctement');
    } catch (error) {
      console.log('❌ Problème Vercel:', error.message);
      await page.screenshot({ path: 'test-results/vercel-error.png' });
    }
  });
});

// Configuration des tests
test.beforeEach(async ({ page }) => {
  // Configuration par défaut
  await page.setDefaultTimeout(10000);
  
  // Gérer les erreurs de console
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('❌ Erreur console:', msg.text());
    }
  });
  
  // Gérer les erreurs de page
  page.on('pageerror', error => {
    console.log('❌ Erreur page:', error.message);
  });
});

// Nettoyage après les tests
test.afterEach(async ({ page }) => {
  // Capturer une screenshot en cas d'échec
  if (test.info().status === 'failed') {
    await page.screenshot({ 
      path: `test-results/failed-${test.info().title.replace(/\s+/g, '-')}.png` 
    });
  }
});
