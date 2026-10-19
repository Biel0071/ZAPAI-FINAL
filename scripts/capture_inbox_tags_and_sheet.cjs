const fs = require('fs');
const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../frontend-official/node_modules/@playwright/test'));

const BASE_URL = 'https://209.50.241.22';
const USERNAME = 'zapadmin';
const PASSWORD = 'zapadmin1010';
const BRAIN_DIR = 'C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40';

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();

  page.on('console', msg => {
    const text = msg.text();
    if (!text.includes('downloadable font') && !text.includes('React Router Future Flag')) {
      console.log('BROWSER:', text);
    }
  });

  console.log('[EVIDENCE] Navigating to /login...');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1500);

  console.log('[EVIDENCE] Filling login credentials (#login-username, #login-password)...');
  await page.fill('#login-username', USERNAME);
  await page.fill('#login-password', PASSWORD);
  await page.click('button[type="submit"]');
  console.log('[EVIDENCE] Clicked Entrar, waiting for redirect...');
  await page.waitForTimeout(4000);

  console.log('[EVIDENCE] Navigating to /inbox...');
  await page.goto(`${BASE_URL}/inbox`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);

  const sessionSelector = page.locator('select[aria-label="Filtrar por conexão"]');
  if (await sessionSelector.isVisible()) {
    console.log('[EVIDENCE] Selecting connection "main"...');
    await sessionSelector.selectOption('main');
    await page.waitForTimeout(4000);
  }

  const convCount = await page.locator('[role="button"][data-conversation-id]').count();
  console.log('[EVIDENCE] Conversations found in DOM:', convCount);

  if (convCount > 0) {
    const firstConv = page.locator('[role="button"][data-conversation-id]').first();
    await firstConv.click();
    await page.waitForTimeout(3000);

    // Ensure Atendimento tab is visible
    const aiTab = page.locator('button[value="ai"], button[aria-label="Atendimento"]').first();
    if (await aiTab.isVisible()) {
      await aiTab.click();
      await page.waitForTimeout(1500);
    }

    // 1. Capture sidebar with enhanced tags
    console.log('[EVIDENCE] Capturing sidebar tags...');
    const tagsPath = path.join(BRAIN_DIR, 'VERIFY_INBOX_SIDEBAR_TAGS_ENHANCED.png');
    await page.screenshot({ path: tagsPath, fullPage: false });
    console.log('Saved:', tagsPath);

    // 2. Open OrderSheetModal
    console.log('[EVIDENCE] Opening OrderSheetModal...');
    const sheetBtn = page.locator('button:has-text("Gerar Ficha")').first();
    if (await sheetBtn.isVisible()) {
      await sheetBtn.click();
      await page.waitForTimeout(3500);

      const modalPath = path.join(BRAIN_DIR, 'VERIFY_INBOX_ORDER_SHEET_CLEAN_DATA.png');
      await page.screenshot({ path: modalPath, fullPage: false });
      console.log('Saved:', modalPath);
    }
  } else {
    console.log('[EVIDENCE] Taking fallback inbox screenshot...');
    const fallbackPath = path.join(BRAIN_DIR, 'VERIFY_INBOX_FALLBACK.png');
    await page.screenshot({ path: fallbackPath, fullPage: false });
  }

  await browser.close();
}

run().catch(console.error);
