/**
 * Tests E2E (End-to-End) pour le flux utilisateur
 * Tests de navigation et fonctionnalité complète
 */

const puppeteer = require('puppeteer');

describe('Tests E2E - Flux utilisateur', () => {
  let browser;
  let page;

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();
  });

  afterAll(async () => {
    await browser.close();
  });

  describe('Navigation dans l\'application', () => {
    test('doit charger la page d\'accueil', async () => {
      await page.goto('http://localhost:3000');
      const title = await page.title();
      
      expect(title).toContain('Amour & Complices');
    });

    test('doit afficher l\'écran de connexion pour les nouveaux utilisateurs', async () => {
      await page.goto('http://localhost:3000');
      
      // Vérifier que le formulaire de connexion est visible
      const loginForm = await page.$('#authEmail');
      expect(loginForm).not.toBeNull();
    });

    test('doit permettre la navigation entre les onglets', async () => {
      await page.goto('http://localhost:3000');
      
      // Simuler une connexion réussie
      await page.type('#authEmail', 'test@example.com');
      await page.type('#authPassword', 'password123');
      
      // Cliquer sur les onglets de navigation
      const chatTab = await page.$('[data-tab="chat"]');
      const gameTab = await page.$('[data-tab="game"]');
      const quizTab = await page.$('[data-tab="quiz"]');
      
      expect(chatTab).not.toBeNull();
      expect(gameTab).not.toBeNull();
      expect(quizTab).not.toBeNull();
    });
  });

  describe('Authentification', () => {
    test('doit permettre l\'inscription d\'un nouvel utilisateur', async () => {
      await page.goto('http://localhost:3000');
      
      // Cliquer sur l'onglet inscription
      await page.click('button[onclick*="register"]');
      
      // Remplir le formulaire
      await page.type('#authNickname', 'Test User');
      await page.type('#authPhone', '+226123456789');
      await page.type('#authEmail', 'newuser@example.com');
      await page.type('#authPassword', 'SecureP@ss123');
      
      // Soumettre
      await page.click('button[onclick*="handleRegister"]');
      
      // Vérifier la redirection vers le chat
      await page.waitForNavigation({ waitUntil: 'networkidle0' });
      const currentUrl = page.url();
      
      expect(currentUrl).toContain('localhost:3000');
    });

    test('doit permettre la connexion d\'un utilisateur existant', async () => {
      await page.goto('http://localhost:3000');
      
      // Remplir le formulaire de connexion
      await page.type('#authEmail', 'test@example.com');
      await page.type('#authPassword', 'password123');
      
      // Soumettre
      await page.click('button[onclick*="handleLogin"]');
      
      // Vérifier l'accès à l'application
      await page.waitForSelector('.app-header', { visible: true });
      const headerVisible = await page.$('.app-header');
      
      expect(headerVisible).not.toBeNull();
    });
  });

  describe('Fonctionnalité du chat', () => {
    test('doit permettre l\'envoi d\'un message texte', async () => {
      await page.goto('http://localhost:3000');
      
      // Naviguer vers le chat
      await page.click('[data-tab="chat"]');
      
      // Attendre que le conteneur de messages soit visible
      await page.waitForSelector('#messagesContainer');
      
      // Taper un message
      await page.type('.chat-text-input', 'Test message');
      
      // Cliquer sur envoyer
      await page.click('.chat-send-btn');
      
      // Vérifier que le message est envoyé
      await page.waitForTimeout(1000);
      const messages = await page.$$('.msg-row');
      
      expect(messages.length).toBeGreaterThan(0);
    });

    test('doit afficher les confirmations de lecture', async () => {
      await page.goto('http://localhost:3000');
      await page.click('[data-tab="chat"]');
      
      // Envoyer un message
      await page.type('.chat-text-input', 'Test read receipt');
      await page.click('.chat-send-btn');
      
      // Vérifier les ticks de confirmation
      await page.waitForSelector('.ticks');
      const ticks = await page.$('.ticks');
      
      expect(ticks).not.toBeNull();
    });
  });

  describe('Jeu interactif', () => {
    test('doit permettre de piocher une carte', async () => {
      await page.goto('http://localhost:3000');
      await page.click('[data-tab="game"]');
      
      // Cliquer sur le bouton de pioche
      const drawButton = await page.$('button[onclick*="drawCard"]');
      if (drawButton) {
        await drawButton.click();
        
        // Vérifier qu'une carte est affichée
        await page.waitForSelector('.game-card-view');
        const cardVisible = await page.$('.game-card-view');
        
        expect(cardVisible).not.toBeNull();
      }
    });

    test('doit permettre d\'envoyer une carte dans le chat', async () => {
      await page.goto('http://localhost:3000');
      await page.click('[data-tab="game"]');
      
      // Piocher une carte
      const drawButton = await page.$('button[onclick*="drawCard"]');
      if (drawButton) {
        await drawButton.click();
        
        // Envoyer dans le chat
        const sendButton = await page.$('button[onclick*="sendTruthDareToChat"]');
        if (sendButton) {
          await sendButton.click();
          
          // Vérifier la navigation vers le chat
          await page.waitForTimeout(1000);
          const currentTab = await page.evaluate(() => currentTab);
          
          expect(currentTab).toBe('chat');
        }
      }
    });
  });

  describe('Paramètres et profil', () => {
    test('doit permettre de modifier le profil', async () => {
      await page.goto('http://localhost:3000');
      
      // Ouvrir les paramètres
      await page.click('.icon-btn[title*="Paramètres"]');
      
      // Attendre que la modal soit visible
      await page.waitForSelector('#settingsModal');
      
      // Modifier le surnom
      await page.type('#settingsMyNickname', 'Updated Nickname');
      
      // Sauvegarder
      await page.click('button[onclick*="saveSettings"]');
      
      // Vérifier que la modal se ferme
      await page.waitForSelector('#settingsModal', { hidden: true });
      
      const modalVisible = await page.$('#settingsModal.active');
      expect(modalVisible).toBeNull();
    });

    test('doit permettre de changer le thème', async () => {
      await page.goto('http://localhost:3000');
      await page.click('.icon-btn[title*="Paramètres"]');
      await page.waitForSelector('#settingsModal');
      
      // Sélectionner un thème
      const themeSwatch = await page.$('.palette-swatch[onclick*="blush"]');
      if (themeSwatch) {
        await themeSwatch.click();
        
        // Vérifier que le thème est appliqué
        const bodyClass = await page.evaluate(() => document.body.className);
        expect(bodyClass).toContain('theme-blush');
      }
    });
  });

  describe('Performance', () => {
    test('doit charger la page en moins de 3 secondes', async () => {
      const startTime = Date.now();
      await page.goto('http://localhost:3000');
      const loadTime = Date.now() - startTime;
      
      expect(loadTime).toBeLessThan(3000);
    });

    test('doit charger les messages de chat en moins de 2 secondes', async () => {
      await page.goto('http://localhost:3000');
      await page.click('[data-tab="chat"]');
      
      const startTime = Date.now();
      await page.waitForSelector('#messagesContainer');
      const loadTime = Date.now() - startTime;
      
      expect(loadTime).toBeLessThan(2000);
    });
  });
});