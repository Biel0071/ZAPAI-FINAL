const { chromium } = require('../../frontend-official/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--ignore-certificate-errors'] });
  const page = await browser.newPage({ ignoreHTTPSErrors: true });
  await page.goto('https://209.50.241.22:1000/login');
  await page.locator('#login-username').fill('zapadmin');
  await page.locator('#login-password').fill('zapadmin1010');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(4000);
  await page.goto('https://209.50.241.22:1000/inbox');
  await page.waitForTimeout(4000);

  const searchInput = page.locator('input[placeholder*="Buscar conversas"], input[placeholder*="Buscar"]').first();
  await searchInput.fill('Deposito');
  await page.waitForTimeout(2000);
  await page.locator('[data-conversation-id="12574"], .inbox-message:has-text("Deposito")').first().click();
  await page.waitForTimeout(5000);

  const res = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('[data-testid="whatsapp-product-card"]')).map(c => {
      const img = c.querySelector('img');
      const h4 = c.querySelector('h4');
      const span = c.querySelector('span');
      const verBtn = c.querySelector('button');
      return {
        title: h4?.innerText,
        price: span?.innerText,
        imgSrc: img?.src,
        imgNaturalWidth: img?.naturalWidth,
        hasVerBtn: Boolean(verBtn)
      };
    });
    // Check if any element containing 'Indisponível' exists in the chat container
    const brokenAttachments = Array.from(document.querySelectorAll('.chat-bubble')).filter(b => b.innerText.includes('Indisponível')).length;
    return { cards, brokenAttachments };
  });
  console.log('PRODUCT CARDS ON LIVE DOM:', JSON.stringify(res, null, 2));

  // If there is a product card, click its 'Ver' button and screenshot the drawer!
  const verBtn = page.locator('[data-testid="whatsapp-product-card"] button:has-text("Ver")').first();
  if (await verBtn.count() > 0) {
    console.log('Clicking "Ver" on product card in Deposito...');
    await verBtn.click();
    await page.waitForTimeout(3000);

    const drawerInfo = await page.evaluate(() => {
      const title = document.querySelector('h2')?.innerText;
      const price = document.querySelector('.text-emerald-400.font-extrabold')?.innerText;
      const thumbs = Array.from(document.querySelectorAll('img[alt^="Miniatura"]')).map(img => img.src);
      const mainImg = document.querySelector('.max-h-\\[380px\\] img')?.src;
      return { title, price, mainImg, thumbs };
    });
    console.log('DRAWER INFO:', JSON.stringify(drawerInfo, null, 2));

    const drawerShot = 'C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40/live_deposito_product_drawer_verified.png';
    await page.screenshot({ path: drawerShot, fullPage: false });
    console.log('Saved drawer screenshot to:', drawerShot);
  }

  await browser.close();
})();

