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

  console.log('[EVIDENCE] Logging in...');
  await page.fill('#login-username', USERNAME);
  await page.fill('#login-password', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);

  console.log('[EVIDENCE] Navigating to /inbox...');
  await page.goto(`${BASE_URL}/inbox`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);

  const sessionSelector = page.locator('select[aria-label="Filtrar por conexão"]');
  if (await sessionSelector.isVisible()) {
    console.log('[EVIDENCE] Selecting connection "main" (Offline)...');
    await sessionSelector.selectOption('main');
    await page.waitForTimeout(4000);
  }

  // Click first conversation if present
  const convCount = await page.locator('[role="button"][data-conversation-id]').count();
  console.log('[EVIDENCE] Conversations found in DOM:', convCount);

  if (convCount > 0) {
    const firstConv = page.locator('[role="button"][data-conversation-id]').first();
    await firstConv.click();
    await page.waitForTimeout(3000);
  }

  const offlineShotPath = path.join(BRAIN_DIR, 'VERIFY_INBOX_SESSION_OFFLINE_SCREEN.png');
  await page.screenshot({ path: offlineShotPath, fullPage: false });
  console.log('[EVIDENCE] Captured:', offlineShotPath);

  // If another session exists, switch to it to verify strict isolation
  const options = await sessionSelector.locator('option').allTextContents();
  console.log('[EVIDENCE] Session options available:', options);

  await browser.close();
  console.log('[EVIDENCE] Done.');
}

run().catch(err => {
  console.error('[ERROR]', err);
  process.exit(1);
});
