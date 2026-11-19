const { chromium } = require('../../frontend-official/node_modules/playwright');
const path = require('path');

const ARTIFACT_DIR = path.resolve('C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40');

async function captureDetailedInbox() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--no-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true
  });

  const page = await context.newPage();

  await page.goto('https://209.50.241.22:1000', { waitUntil: 'networkidle', timeout: 30000 });
  const userInput = page.locator('input[type="text"]').first();
  if (await userInput.isVisible()) {
    await userInput.fill('zapadmin');
    await page.locator('input[type="password"]').first().fill('zapadmin1010');
    await page.locator('button[type="submit"], button:has-text("Entrar")').first().click();
    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
  }

  await page.goto('https://209.50.241.22:1000/inbox', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3500);

  // Click on the conversation with 9805-1085
  const conversationRow = page.locator('text=+55 (49) 9805-1085, text=9805-1085, text=Mariza Marcelino').first();
  if (await conversationRow.isVisible()) {
    await conversationRow.click();
    await page.waitForTimeout(2000);
  }

  // Click attachment button (+)
  const attachBtn = page.locator('button[aria-label="Anexar arquivo"]').first();
  if (await attachBtn.isVisible()) {
    await attachBtn.click();
    await page.waitForTimeout(1000);

    // Click on "Catálogo de Produtos" option in menu
    const catalogOption = page.locator('text=Catálogo de Produtos, text=Catálogo, text=Produtos').first();
    if (await catalogOption.isVisible()) {
      await catalogOption.click();
      await page.waitForTimeout(2000);
    }
  }

  // Capture screenshot with open catalog popover
  const catalogPopoverImg = path.join(ARTIFACT_DIR, 'live_vps_inbox_catalog_official_synced.png');
  await page.screenshot({ path: catalogPopoverImg });
  console.log('Saved catalog popover screenshot:', catalogPopoverImg);

  // Inspect the items visible inside the popover
  const productCards = await page.locator('[data-testid="catalog-product-item"], div:has(> img[alt])').allTextContents();
  console.log('Items found in DOM:', productCards.length);

  await browser.close();
}

captureDetailedInbox().catch(console.error);

