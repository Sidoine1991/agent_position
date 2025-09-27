// Configuration Playwright pour Presence CCRB
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  // Dossier de test
  testDir: './tests',
  
  // Dossier de sortie
  outputDir: './test-results',
  
  // Timeout global
  timeout: 30000,
  
  // Timeout pour chaque test
  expect: {
    timeout: 10000
  },
  
  // Configuration des navigateurs
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  
  // Configuration du serveur de test
  webServer: {
    command: 'node server.js',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  
  // Configuration des reporters
  reporter: [
    ['html', { outputFolder: 'test-results/html' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/results.xml' }],
    ['list']
  ],
  
  // Configuration globale
  use: {
    // Base URL pour les tests
    baseURL: process.env.TEST_URL || 'http://localhost:3000',
    
    // Timeout pour les actions
    actionTimeout: 10000,
    
    // Navigation timeout
    navigationTimeout: 30000,
    
    // Screenshot en cas d'échec
    screenshot: 'only-on-failure',
    
    // Vidéo en cas d'échec
    video: 'retain-on-failure',
    
    // Trace pour le debugging
    trace: 'retain-on-failure',
  },
  
  // Configuration des workers
  workers: process.env.CI ? 1 : undefined,
  
  // Configuration de retry
  retries: process.env.CI ? 2 : 0,
  
  // Configuration des timeouts
  globalTimeout: 600000,
  
  // Configuration des hooks
  globalSetup: require.resolve('./tests/global-setup.js'),
  globalTeardown: require.resolve('./tests/global-teardown.js'),
});
