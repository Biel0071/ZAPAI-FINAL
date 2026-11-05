const { chromium } = require('../../frontend-official/node_modules/playwright');
const path = require('path');

const ARTIFACT_DIR = path.resolve('C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40');

async function testPopoverDirect() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--no-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true
  });

  const page = await context.newPage();

  // Login
  await page.goto('https://209.50.241.22:1000', { waitUntil: 'networkidle', timeout: 30000 });
  const userInput = page.locator('input[type="text"]').first();
  if (await userInput.isVisible()) {
    await userInput.fill('zapadmin');
    await page.locator('input[type="password"]').first().fill('zapadmin1010');
    await page.locator('button[type="submit"]').first().click();
    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  }

  // Go to /inbox
  await page.goto('https://209.50.241.22:1000/inbox', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Click on a conversation
  await page.locator('h4').first().click();
  await page.waitForTimeout(1500);

  // Look for any button that triggers catalog popover (e.g. [title*="Catálogo"], [aria-label*="Catálogo"], or Storefront icon)
  const catalogBtn = page.locator('button:has(svg):has-text(""), button[title*="Catálogo"], button[title*="catálogo"], button[aria-label*="Catálogo"]').filter({
    has: page.locator('svg')
  });

  console.log('Found buttons:', await catalogBtn.count());
  for (let i = 0; i < await catalogBtn.count(); i++) {
    const btn = catalogBtn.nth(i);
    const title = await btn.getAttribute('title');
    const aria = await btn.getAttribute('aria-label');
    console.log(`Button ${i}: title="${title}", aria="${aria}"`);
  }

  // Click the attachment button (+ / clip)
  const clip = page.locator('button:has(svg)').filter({ hasNotText: 'Enviar' }).nth(4);
  console.log('Clicking attach...');
  // Let's find button with title "Anexar" or aria-label="Anexar arquivo"
  const attach = page.locator('button[title*="Anexar"], button[aria-label*="Anexar"]').first();
  if (await attach.isVisible()) {
    await attach.click();
    await page.waitForTimeout(800);
    // In menu, click Catálogo
    const catItem = page.locator('text=Catálogo').first();
    if (await catItem.isVisible()) {
      console.log('Clicking Catálogo menu item...');
      await catItem.click();
      await page.waitForTimeout(1500);
    }
  }

  // Take screenshot of popover
  const shotPath = path.join(ARTIFACT_DIR, 'live_vps_inbox_catalog_official_synced.png');
  await page.screenshot({ path: shotPath });
  console.log('Saved screenshot:', shotPath);

  await browser.close();
}

testPopoverDirect().catch(console.error);

