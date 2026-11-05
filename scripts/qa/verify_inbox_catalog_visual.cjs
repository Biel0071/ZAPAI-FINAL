const { chromium } = require('../../frontend-official/node_modules/playwright');
const path = require('path');
const fs = require('fs');

async function verify() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--no-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true
  });

  const page = await context.newPage();

  console.log('Navigating to login...');
  await page.goto('https://209.50.241.22:1000/login');
  await page.locator('#login-username').fill('zapadmin');
  await page.locator('#login-password').fill('zapadmin1010');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(4000);

  console.log('Navigating to inbox...');
  await page.goto('https://209.50.241.22:1000/inbox');
  await page.waitForTimeout(4000);

  const row = page.locator('[data-conversation-id="12574"], [data-conversation-id="17061"]').first();
  const rowCount = await row.count();
  console.log('Target row count:', rowCount);
  if (rowCount > 0) {
    const id = await row.getAttribute('data-conversation-id');
    console.log('Clicking row with conversation id:', id);
    await row.click();
    await page.waitForTimeout(5000);
  }

  // Inspect the active chat pane
  const chatBubbleCount = await page.locator('.chat-bubble').count();
  console.log('Chat bubbles count:', chatBubbleCount);

  // Check product cards
  const productCards = page.locator('[data-testid="whatsapp-product-card"]');
  const productCardCount = await productCards.count();
  console.log('WhatsApp Product Cards count:', productCardCount);

  // Check if any broken attachment fallback is shown inside the product bubble
  const fallbackBox = page.locator('.chat-bubble:has([data-testid="whatsapp-product-card"]) div:has-text("Indisponível")');
  const hasBrokenAttachment = (await fallbackBox.count()) > 0;
  console.log('Has broken attachment preview inside product bubble:', hasBrokenAttachment);

  // Check BLOCO 10 specifically
  const blocoCard = page.locator('[data-testid="whatsapp-product-card"]:has-text("BLOCO 10")').first();
  const hasBlocoCard = (await blocoCard.count()) > 0;
  console.log('Has BLOCO 10 Card:', hasBlocoCard);

  let blocoImgSrc = '';
  let blocoNaturalWidth = 0;
  if (hasBlocoCard) {
    await blocoCard.scrollIntoViewIfNeeded();
    const imgEl = blocoCard.locator('img').first();
    blocoImgSrc = await imgEl.getAttribute('src');
    blocoNaturalWidth = await imgEl.evaluate((img) => img.naturalWidth);
    console.log('BLOCO 10 image src:', blocoImgSrc, 'naturalWidth:', blocoNaturalWidth);
  }

  // Save full screenshot of inbox
  const screenshotPath = 'C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40/live_inbox_authentic_product_verified.png';
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log('Saved verification screenshot to:', screenshotPath);

  // Click 'Ver' on BLOCO 10 card if available, else first product card
  const targetCard = hasBlocoCard ? blocoCard : productCards.first();
  const verBtn = targetCard.locator('button:has-text("Ver")').first();
  if (await verBtn.count() > 0) {
    console.log('Clicking "Ver" button on product card...');
    await verBtn.click();
    await page.waitForTimeout(3000);

    const drawerThumbnails = await page.locator('img[alt^="Miniatura"]').count();
    console.log('ProductDetailDrawer thumbnails count:', drawerThumbnails);

    const drawerScreenshotPath = 'C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40/live_inbox_product_drawer_gallery_verified.png';
    await page.screenshot({ path: drawerScreenshotPath, fullPage: false });
    console.log('Saved drawer screenshot to:', drawerScreenshotPath);
  }

  await browser.close();

  return {
    chatBubbleCount,
    productCardCount,
    hasBrokenAttachment,
    hasBlocoCard,
    blocoImgSrc,
    blocoNaturalWidth,
  };
}

verify()
  .then((res) => console.log('VERIFICATION COMPLETE:', JSON.stringify(res, null, 2)))
  .catch((err) => {
    console.error('VERIFICATION ERROR:', err);
    process.exit(1);
  });
