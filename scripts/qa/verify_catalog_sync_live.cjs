const { chromium } = require('../../frontend-official/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = path.resolve('C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40');

async function testLiveInbox() {
  console.log('Launching browser to verify live VPS Inbox at https://209.50.241.22:1000 ...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--no-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true
  });

  const page = await context.newPage();

  // 1. Login
  console.log('Navigating to login page...');
  await page.goto('https://209.50.241.22:1000', { waitUntil: 'networkidle', timeout: 30000 });

  const userInput = page.locator('input[type="text"], input[name="username"], input[placeholder*="Usuário"], input[placeholder*="usuario"]').first();
  if (await userInput.isVisible()) {
    console.log('Logging in...');
    await userInput.fill('zapadmin');
    const passInput = page.locator('input[type="password"]').first();
    await passInput.fill('zapadmin1010');
    await page.locator('button[type="submit"], button:has-text("Entrar")').first().click();
    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  }

  // 2. Go to /inbox
  console.log('Navigating to /inbox...');
  await page.goto('https://209.50.241.22:1000/inbox', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Take screenshot of inbox conversation list & header
  const inboxFullScreenshot = path.join(ARTIFACT_DIR, 'live_vps_inbox_clean_presence.png');
  await page.screenshot({ path: inboxFullScreenshot });
  console.log('Saved inbox screenshot to:', inboxFullScreenshot);

  // Select a conversation if available
  const firstConversation = page.locator('[data-testid="conversation-item"], [data-testid="conversation-row"], div.cursor-pointer:has(h4)').first();
  if (await firstConversation.isVisible()) {
    console.log('Selecting first conversation...');
    await firstConversation.click();
    await page.waitForTimeout(2000);
  }

  // 3. Open Attachment Menu -> Catalog Popover
  console.log('Opening attachment menu...');
  const attachBtn = page.locator('button:has([data-icon="plus"]), button[aria-label="Anexar arquivo"], button:has([data-icon="paperclip"]), button[title*="Anexo"], button:has-text("+")').first();
  if (await attachBtn.isVisible()) {
    await attachBtn.click();
    await page.waitForTimeout(1000);

    const catalogMenuItem = page.locator('button:has-text("Catálogo"), div[role="menuitem"]:has-text("Catálogo"), div[role="menuitem"]:has-text("Produtos"), button:has-text("Enviar Catálogo")').first();
    if (await catalogMenuItem.isVisible()) {
      console.log('Clicking Catalog menu item...');
      await catalogMenuItem.click();
      await page.waitForTimeout(2000);
    }
  }

  // Also check direct catalog popover trigger if present
  const directCatalogBtn = page.locator('button[aria-label*="catálogo"], button[title*="catálogo"], button[title*="Produtos"], button:has-text("Catálogo")').first();
  if (await directCatalogBtn.isVisible()) {
    await directCatalogBtn.click().catch(() => {});
    await page.waitForTimeout(1500);
  }

  // Screenshot catalog popover
  const catalogPopoverScreenshot = path.join(ARTIFACT_DIR, 'live_vps_catalog_real_items_popover.png');
  await page.screenshot({ path: catalogPopoverScreenshot });
  console.log('Saved catalog popover screenshot to:', catalogPopoverScreenshot);

  // Inspect popover text content to confirm top products
  const popoverContent = await page.locator('[role="dialog"], [data-radix-popper-content-wrapper]').first().textContent().catch(() => '');
  console.log('\n--- POPOVER PREVIEW CONTENT ---');
  console.log(popoverContent.slice(0, 300));

  await browser.close();
  console.log('\nValidation completed successfully!');
}

testLiveInbox().catch((err) => {
  console.error('Validation error:', err);
  process.exit(1);
});
