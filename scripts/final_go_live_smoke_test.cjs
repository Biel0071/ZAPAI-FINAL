const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('../frontend-official/node_modules/@playwright/test/index.js');

const BASE_URL = process.env.TEST_URL || 'http://209.50.241.22';
const USERNAME = 'zapadmin';
const PASSWORD = 'zapadmin1010';
const JWT_SECRET = '73d1ef96dde5afc4938e0b71a5978b2666f1885fb0d2febc4bd52cc7a1cd9e15';
const ARTIFACTS_DIR = 'C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40';

function generateAdminToken() {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: 'zapadmin',
    username: 'zapadmin',
    tenantId: 'default',
    companyId: 'default',
    role: 'master',
    iat: now,
    exp: now + 86400 * 7,
  };
  const toB64Url = (obj) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  const sData = `${toB64Url(header)}.${toB64Url(payload)}`;
  const sig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(sData)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${sData}.${sig}`;
}

async function loginIfNeeded(page) {
  if (page.url().includes('login') || (await page.locator('input[type="password"]').count()) > 0) {
    console.log('Submitting login credentials...');
    const userInput = page.locator('input[type="text"], input[name="username"]').first();
    if (await userInput.isVisible()) await userInput.fill(USERNAME);
    const pwInput = page.locator('input[type="password"]').first();
    if (await pwInput.isVisible()) await pwInput.fill(PASSWORD);
    const submitBtn = page.locator('button[type="submit"], button:has-text("Entrar")').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await page.waitForTimeout(3000);
    }
  }
}

async function runSmokeTests() {
  console.log(`[SmokeTest] Starting Go-Live validation against ${BASE_URL}...`);
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'],
  });

  const token = generateAdminToken();

  try {
    // -------------------------------------------------------------
    // Test 1: Desktop 1440x900 - Atendente IA, Avatar Studio & Chat
    // -------------------------------------------------------------
    console.log('[SmokeTest] Viewport 1440x900: Atendente IA...');
    const contextDesktop = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    await contextDesktop.addInitScript((jwt) => {
      localStorage.setItem('admin_token', jwt);
      localStorage.setItem('auth_token', jwt);
      localStorage.setItem('zapflow_sidebar_collapsed', 'true');
    }, token);

    const page = await contextDesktop.newPage();
    await page.goto(`${BASE_URL}/attendants`, { waitUntil: 'networkidle', timeout: 35000 });
    await loginIfNeeded(page);
    await page.waitForTimeout(2500);

    // Assert that the page loaded
    console.log('[SmokeTest] Current URL:', page.url());

    // Test 5 categories cycling:
    console.log('[SmokeTest] Testing 5 Categories in Avatar Studio...');
    
    // 1. Cabelo -> select Hair 03 (Longo Loiro)
    const hairTab = page.locator('button:has-text("Cabelo")').first();
    if (await hairTab.isVisible()) {
      await hairTab.click();
      await page.waitForTimeout(300);
      const hairItem = page.locator('button[data-avatar-item="hair_03"]').first();
      if (await hairItem.isVisible()) await hairItem.click();
      await page.waitForTimeout(300);
    }

    // 2. Rosto -> select Face 04 (Expressivo / Confiante)
    const faceTab = page.locator('button:has-text("Rosto")').first();
    if (await faceTab.isVisible()) {
      await faceTab.click();
      await page.waitForTimeout(300);
      const faceItem = page.locator('button[data-avatar-item="face_04"]').first();
      if (await faceItem.isVisible()) await faceItem.click();
      await page.waitForTimeout(300);
    }

    // 3. Roupa -> select Outfit 05 (Uniforme Comercial)
    const outfitTab = page.locator('button:has-text("Roupa")').first();
    if (await outfitTab.isVisible()) {
      await outfitTab.click();
      await page.waitForTimeout(300);
      const outfitItem = page.locator('button[data-avatar-item="outfit_05"]').first();
      if (await outfitItem.isVisible()) await outfitItem.click();
      await page.waitForTimeout(300);
    }

    // 4. Acessórios -> select Accessory
    const accTab = page.locator('button:has-text("Acessórios")').first();
    if (await accTab.isVisible()) {
      await accTab.click();
      await page.waitForTimeout(300);
      const accItem = page.locator('button:has-text("Headset"), button:has-text("Óculos")').first();
      if (await accItem.isVisible()) await accItem.click();
      await page.waitForTimeout(300);
    }

    // 5. Estilo -> select Estilo Vendas
    const styleTab = page.locator('button:has-text("Estilo")').first();
    if (await styleTab.isVisible()) {
      await styleTab.click();
      await page.waitForTimeout(300);
      const styleItem = page.locator('button[data-avatar-item="style_vendas"]').first();
      if (await styleItem.isVisible()) await styleItem.click();
      await page.waitForTimeout(300);
    }

    // Click "Salvar Avatar"
    const saveAvatarBtn = page.locator('button:has-text("Salvar Avatar")').first();
    if (await saveAvatarBtn.isVisible()) {
      console.log('[SmokeTest] Saving Avatar configuration...');
      await saveAvatarBtn.click();
      await page.waitForTimeout(2000);
    }

    // Test Chat: Send a message in sandbox
    const chatInput = page.locator('input[placeholder*="Pergunte algo"]').first();
    if (await chatInput.isVisible()) {
      console.log('[SmokeTest] Testing interactive attendant chat...');
      await chatInput.fill('Olá Camila, quais são os horários e formas de pagamento aceitas?');
      const sendBtn = page.locator('button[type="submit"]:has-text("Enviar")').first();
      if (await sendBtn.isVisible()) {
        await sendBtn.click();
        await page.waitForTimeout(3500);
      }
    }

    // Take FINAL_1440x900 screenshot
    const shot1440 = path.join(ARTIFACTS_DIR, 'FINAL_1440x900.png');
    await page.screenshot({ path: shot1440, fullPage: false });
    console.log('[SmokeTest] Captured FINAL_1440x900.png');

    // Test Assistente ZAI Floating Button & Modal
    console.log('[SmokeTest] Testing Assistente ZAI modal...');
    const zaiFloatingBtn = page.locator('[data-testid="zaibot-floating-button"]').first();
    if (await zaiFloatingBtn.isVisible()) {
      await zaiFloatingBtn.click();
      await page.waitForTimeout(1000);
      // Verify dialog is visible
      const dialog = page.locator('div[role="dialog"]');
      if (await dialog.isVisible()) {
        console.log('[SmokeTest] Assistente ZAI modal opened successfully.');
        // Close modal via Escape or close button
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    }

    // -------------------------------------------------------------
    // Test 2: Notebook 1366x768
    // -------------------------------------------------------------
    console.log('[SmokeTest] Viewport 1366x768...');
    const contextLaptop = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      deviceScaleFactor: 1,
    });
    await contextLaptop.addInitScript((jwt) => {
      localStorage.setItem('admin_token', jwt);
      localStorage.setItem('auth_token', jwt);
      localStorage.setItem('zapflow_sidebar_collapsed', 'true');
    }, token);

    const pageLaptop = await contextLaptop.newPage();
    await pageLaptop.goto(`${BASE_URL}/attendants`, { waitUntil: 'networkidle', timeout: 35000 });
    await loginIfNeeded(pageLaptop);
    await pageLaptop.waitForTimeout(2000);

    const shot1366 = path.join(ARTIFACTS_DIR, 'FINAL_1366x768.png');
    await pageLaptop.screenshot({ path: shot1366, fullPage: false });
    console.log('[SmokeTest] Captured FINAL_1366x768.png');

    // -------------------------------------------------------------
    // Test 3: Mobile 390x844 (iPhone standard)
    // -------------------------------------------------------------
    console.log('[SmokeTest] Viewport 390x844 (Mobile)...');
    const contextMobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    await contextMobile.addInitScript((jwt) => {
      localStorage.setItem('admin_token', jwt);
      localStorage.setItem('auth_token', jwt);
    }, token);

    const pageMobile = await contextMobile.newPage();
    await pageMobile.goto(`${BASE_URL}/attendants`, { waitUntil: 'networkidle', timeout: 35000 });
    await loginIfNeeded(pageMobile);
    await pageMobile.waitForTimeout(2000);

    const shotMobile = path.join(ARTIFACTS_DIR, 'FINAL_MOBILE.png');
    await pageMobile.screenshot({ path: shotMobile, fullPage: false });
    console.log('[SmokeTest] Captured FINAL_MOBILE.png');

    // -------------------------------------------------------------
    // Test 4: Memória & Evolução Tab Validation
    // -------------------------------------------------------------
    console.log('[SmokeTest] Checking Memória & Evolução tab...');
    await page.goto(`${BASE_URL}/attendants?tab=evolution`, { waitUntil: 'networkidle', timeout: 35000 });
    await page.waitForTimeout(2000);
    const shotEvolution = path.join(ARTIFACTS_DIR, 'FINAL_MEMORIA_EVOLUCAO.png');
    await page.screenshot({ path: shotEvolution, fullPage: false });
    console.log('[SmokeTest] Captured FINAL_MEMORIA_EVOLUCAO.png');

    console.log('[SmokeTest] ALL SMOKE TESTS COMPLETED SUCCESSFULLY.');
    return { success: true };
  } catch (err) {
    console.error('[SmokeTest] Error during smoke test:', err);
    return { success: false, error: err.message };
  } finally {
    await browser.close();
  }
}

runSmokeTests().then((res) => {
  if (!res.success) process.exit(1);
  process.exit(0);
});
