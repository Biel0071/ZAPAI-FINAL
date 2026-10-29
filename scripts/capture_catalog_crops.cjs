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
  await page.waitForTimeout(4000);

  // Crop 1: Message composer action bar showing Emoji & Catalog button beside each other
  const composerArea = page.locator('div.border-t.border-border\\/40, form').first();
  if (await composerArea.count() > 0) {
    await composerArea.screenshot({
      path: path.join(ARTIFACT_DIR, '06_crop_composer_emoji_and_catalog.png')
    });
  }

  // Open Popover
  const catalogBtn = page.locator('[data-catalog-trigger]').first();
  await catalogBtn.click();
  await page.waitForTimeout(1000);

  // Crop 2: The open catalog popover card
  const popover = page.locator('[data-catalog-popover]').first();
  if (await popover.count() > 0) {
    await popover.screenshot({
      path: path.join(ARTIFACT_DIR, '07_crop_whatsapp_catalog_popover.png')
    });
  }

  console.log('[PLAYWRIGHT] High-res crops saved successfully.');
  await browser.close();
}

run();
