const path = require('path');
const { chromium } = require(path.join(__dirname, '../frontend-official/node_modules/@playwright/test'));

const URL = 'https://209.50.241.22:1000';
const USERNAME = 'zapadmin';
const PASSWORD = 'zapadmin1010';
const ARTIFACT_DIR = path.join('C:\\Users\\Dell\\.gemini\\antigravity\\brain\\578a7157-8bf3-47e3-82f2-9ed1bb8f9f40\\evidence');

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--no-sandbox']
  });

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 960 }
  });

  const page = await context.newPage();

  await page.goto(`${URL}/login`, { timeout: 30000 });
  await page.waitForTimeout(2000);

  if (page.url().includes('login') || (await page.locator('#login-username').count()) > 0) {
    await page.fill('#login-username', USERNAME);
    await page.fill('#login-password', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  await page.goto(`${URL}/inbox`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);

  const convCount = await page.locator('[data-conversation-id]').count();
  console.log(`[PLAYWRIGHT] Found ${convCount} conversations.`);

  if (convCount > 0) {
    const firstConv = page.locator('[data-conversation-id]').first();
    await firstConv.click();
    console.log('[PLAYWRIGHT] Clicked first conversation.');
    await page.waitForTimeout(2500);

    // Open Catalog Popover
    const catalogBtn = page.locator('[data-catalog-trigger]').first();
    if (await catalogBtn.isVisible()) {
      await catalogBtn.click();
      console.log('[PLAYWRIGHT] Clicked catalog trigger.');
      await page.waitForTimeout(1500);

      // Click Enviar no Chat
      const sendBtn = page.locator('button:has-text("Enviar no Chat")').first();
      if (await sendBtn.isVisible()) {
        console.log('[PLAYWRIGHT] Clicking Enviar no Chat...');
        await sendBtn.click();
        await page.waitForTimeout(3000);

        // Capture full screen showing the product card bubble in chat
        await page.screenshot({
          path: path.join(ARTIFACT_DIR, '08_inbox_whatsapp_product_card_sent.png'),
          fullPage: false
        });
        console.log('[PLAYWRIGHT] Screenshot 08 saved successfully.');
      }
    }
  } else {
    console.log('[PLAYWRIGHT] No conversations loaded in Inbox.');
  }

  await browser.close();
}

run();
