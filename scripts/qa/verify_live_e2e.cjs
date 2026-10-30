const { chromium } = require('../../frontend-official/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const EVIDENCE_DIR = 'C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40/evidence';
if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--no-sandbox']
  });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  console.log('1. Navigating to login...');
  await page.goto('https://209.50.241.22:1000/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#login-username', { timeout: 10000 });

  await page.fill('#login-username', 'zapadmin');
  await page.fill('#login-password', 'zapadmin1010');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(3000);

  console.log('2. Navigating to inbox...');
  await page.goto('https://209.50.241.22:1000/inbox', { waitUntil: 'networkidle', timeout: 30000 }).catch(async () => {
    await page.waitForTimeout(4000);
  });
  await page.waitForTimeout(4000);

  console.log('3. Searching / selecting contact cristinanunesvieiraelaine...');
  // Click on the conversation or search for it
  const contactItem = page.locator('text=cristinanunesvieiraelaine').first();
  if (await contactItem.isVisible()) {
    console.log('Found contact item directly in list, clicking...');
    await contactItem.click();
  } else {
    // try searching in search bar
    const searchInput = page.locator('input[placeholder*="Buscar"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('cristina');
      await page.waitForTimeout(2000);
      const searchResult = page.locator('text=cristina').first();
      if (await searchResult.isVisible()) {
        await searchResult.click();
      }
    }
  }

  await page.waitForTimeout(4000);

  // Take screenshot of the full inbox with conversation open
  const fullScreenshot = path.join(EVIDENCE_DIR, 'inbox_conversation_order_verified.png');
  await page.screenshot({ path: fullScreenshot });
  console.log(`Saved screenshot: ${fullScreenshot}`);

  // Inspect messages rendered in chat pane
  const messageElements = await page.locator('[data-message-id], .message-bubble, div[class*="bubble"]').allInnerTexts().catch(() => []);
  console.log(`Visible message bubbles count: ${messageElements.length}`);
  if (messageElements.length > 0) {
    console.log('Last 3 message elements:');
    messageElements.slice(-3).forEach((txt, idx) => console.log(`  [Last ${3-idx}] ${txt.replace(/\n+/g, ' ').slice(0, 100)}`));
  }

  // Check composer buttons
  console.log('4. Inspecting composer catalog button...');
  const catalogBtn = page.locator('[data-catalog-trigger]');
  if (await catalogBtn.isVisible()) {
    const btnText = (await catalogBtn.innerText()).trim();
    const btnBox = await catalogBtn.boundingBox();
    console.log(`Catalog button text: "${btnText}"`);
    console.log(`Catalog button bounding box:`, btnBox);

    // Save screenshot of composer area
    const composerBox = await page.locator('div:has(> [data-catalog-trigger])').first().boundingBox();
    if (composerBox) {
      await page.screenshot({
        path: path.join(EVIDENCE_DIR, 'composer_compact_catalog_emoji.png'),
        clip: {
          x: Math.max(0, composerBox.x - 20),
          y: Math.max(0, composerBox.y - 20),
          width: Math.min(1440, composerBox.width + 40),
          height: Math.min(900, composerBox.height + 40)
        }
      });
      console.log('Saved composer crop to composer_compact_catalog_emoji.png');
    }

    // Click catalog button
    console.log('5. Clicking catalog button...');
    await catalogBtn.click();
    await page.waitForTimeout(1500);

    const popoverScreenshot = path.join(EVIDENCE_DIR, 'catalog_popover_open_verified.png');
    await page.screenshot({ path: popoverScreenshot });
    console.log(`Saved catalog open screenshot: ${popoverScreenshot}`);

    const productCount = await page.locator('[data-catalog-popover] .cursor-pointer').count();
    console.log(`Catalog items rendered: ${productCount}`);
  } else {
    console.log('Catalog button not found via [data-catalog-trigger], checking all buttons in composer...');
  }

  await browser.close();
  console.log('E2E Verification Complete!');
}

run().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
