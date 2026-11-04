const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join(__dirname, '../../frontend-official/node_modules/@playwright/test'));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  console.log('Navigating to login...');
  await page.goto('https://209.50.241.22:1000/login');
  await page.waitForLoadState('networkidle');

  await page.fill('input[type="text"], input[name="username"]', 'zapadmin');
  await page.fill('input[type="password"]', 'zapadmin1010');
  await page.click('button[type="submit"]');

  await page.waitForTimeout(2000);
  if (!page.url().includes('/inbox')) {
    await page.goto('https://209.50.241.22:1000/inbox');
  }
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // Click on the conversation for +55 49 9805-1085 or Mariza
  console.log('Searching for conversation...');
  const chatItem = page.locator('text=9805-1085').first();
  if (await chatItem.isVisible()) {
    await chatItem.click();
  } else {
    const marizaItem = page.locator('text=Mariza').first();
    if (await marizaItem.isVisible()) {
      await marizaItem.click();
    }
  }

  await page.waitForTimeout(3000);

  // Take screenshot of inbox chat
  await page.screenshot({ path: 'C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40/dom_check_inbox.png', fullPage: true });

  // Get message elements HTML
  const productCards = await page.locator('[data-testid="whatsapp-product-card"]').all();
  console.log(`Found ${productCards.length} product card elements`);

  for (let i = 0; i < productCards.length; i++) {
    const html = await productCards[i].innerHTML();
    console.log(`\n--- Card ${i} ---\n`, html);
  }

  await browser.close();
})();
