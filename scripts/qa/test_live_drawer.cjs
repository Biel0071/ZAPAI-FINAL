const { chromium } = require('../../frontend-official/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--ignore-certificate-errors'] });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Navigating to http://209.50.241.22:1000/inbox...');
  await page.goto('http://209.50.241.22:1000/inbox', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Check if login needed
  const userInput = page.locator('input[placeholder*="Usuário" i], input[type="text"]').first();
  if (await userInput.isVisible()) {
    console.log('Logging in...');
    await userInput.fill('zapadmin');
    await page.locator('input[type="password"]').fill('zapadmin1010');
    await page.locator('button[type="submit"], button:has-text("Entrar")').first().click();
    await page.waitForTimeout(3000);
  }

  // Click on Inbox in sidebar if not on inbox
  if (!page.url().includes('/inbox')) {
    await page.locator('a[href="/inbox"]').first().click();
    await page.waitForTimeout(3000);
  }

  // Click on Deposito Material V A
  console.log('Clicking Deposito Material V A...');
  const depositoItem = page.locator('text=/Deposito Material/i').first();
  if (await depositoItem.isVisible()) {
    await depositoItem.click();
    await page.waitForTimeout(4000);
  }

  // Locate the exact "Ver" button inside the product card
  console.log('Looking for exact "Ver" button on product card...');
  const verButton = page.locator('[data-testid="whatsapp-product-card"] button').filter({ hasText: /^Ver$/i }).first();
  if (await verButton.isVisible()) {
    console.log('Clicking exact "Ver" button...');
    await verButton.click();
    await page.waitForTimeout(2500);
  } else {
    console.log('Product card "Ver" button not found by testid, checking general card...');
    const anyVer = page.locator('button').filter({ hasText: /^Ver$/i }).first();
    if (await anyVer.isVisible()) {
      await anyVer.click();
      await page.waitForTimeout(2500);
    }
  }

  // Inspect drawer
  const drawerInfo = await page.evaluate(() => {
    const drawer = document.querySelector('[data-testid="product-detail-drawer"]');
    if (!drawer) return { isOpen: false };
    const title = drawer.querySelector('h2')?.textContent || '';
    const images = Array.from(drawer.querySelectorAll('img')).map(img => img.src);
    const thumbnails = drawer.querySelectorAll('button img');
    return {
      isOpen: true,
      title,
      totalImagesCount: images.length,
      thumbnailsCount: thumbnails.length,
      images,
    };
  });

  console.log('--- DRAWER INFO ---', JSON.stringify(drawerInfo, null, 2));

  const screenshotPath = 'C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40/live_deposito_drawer.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log('Saved drawer screenshot to:', screenshotPath);

  await browser.close();
})();
