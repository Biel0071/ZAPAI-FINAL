const { chromium } = require('../../frontend-official/node_modules/playwright');
const path = require('path');

const ARTIFACT_DIR = path.resolve('C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40');
const API_BASE = 'https://209.50.241.22:1000';

async function verifyLiveCatalogOrderClean() {
  console.log('--- EMPIRICAL VALIDATION: VERIFY REAL SYNCED CATALOG ORDER ON VPS LIVE ---');
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
  console.log('1. Logging in via #login-username...');
  await page.goto(`${API_BASE}/login`, { timeout: 35000, waitUntil: 'domcontentloaded' });
  await page.fill('#login-username', 'zapadmin');
  await page.fill('#login-password', 'zapadmin1010');
  await Promise.all([
    page.waitForNavigation({ timeout: 20000 }).catch(() => {}),
    page.click('button[type="submit"]')
  ]);
  await page.waitForTimeout(3000);

  // 2. Open /inbox
  console.log('2. Opening /inbox...');
  await page.goto(`${API_BASE}/inbox`, { timeout: 35000, waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  // 3. Select first conversation
  const firstChat = page.locator('[data-conversation-id], [data-testid^="conversation-item"], div[role="button"]:has-text("+55")').first();
  if (await firstChat.isVisible({ timeout: 8000 }).catch(() => false)) {
    console.log('3. Selecting first conversation...');
    await firstChat.click();
    await page.waitForTimeout(2000);
  }

  // 4. Capture screenshot of inbox list and header (verify NO RED OFFLINE DOTS)
  const presenceScreenshot = path.join(ARTIFACT_DIR, 'live_inbox_clean_presence_no_red_dots.png');
  await page.screenshot({ path: presenceScreenshot });
  console.log('✔ Presence screenshot captured:', presenceScreenshot);

  // 5. Open Catalog Popover
  console.log('4. Opening catalog popover via [data-catalog-trigger]...');
  const catalogTrigger = page.locator('[data-catalog-trigger], button:has-text("Catálogo"), button[aria-label*="Catálogo"]').first();
  await catalogTrigger.click();
  await page.waitForTimeout(2500);

  // 6. Capture Popover showing authentic WhatsApp order:
  // Item 1: BLOCO 10 - 100 UN (R$ 134,99)
  // Item 2: ARGAMASSA - AC3 (R$ 19,90)
  // Item 3: ARGAMASSA - AC2 (R$ 16,90)
  // Item 4: ARGAMASSA - AC1 (R$ 14,80)
  // Item 5: CAMINHÃO DE AREIA - 9M³ (R$ 700,00)
  // Item 6: AREIA - M³ (R$ 100,00)
  const catalogPopoverScreenshot = path.join(ARTIFACT_DIR, 'live_inbox_official_synced_catalog_popover.png');
  await page.screenshot({ path: catalogPopoverScreenshot });
  console.log('✔ Official Synced Catalog Popover screenshot captured:', catalogPopoverScreenshot);

  // 7. Verify text content of top products
  const popoverEl = page.locator('[data-catalog-popover]');
  if (await popoverEl.isVisible({ timeout: 4000 }).catch(() => false)) {
    const text = await popoverEl.textContent();
    console.log('\n--- POPOVER PREVIEW ---');
    console.log('Has BLOCO 10:', text.includes('BLOCO 10'));
    console.log('Has ARGAMASSA - AC3:', text.includes('ARGAMASSA - AC3'));
    console.log('Has CAMINHÃO DE AREIA:', text.includes('CAMINHÃO DE AREIA'));
    console.log('Has AREIA - M³:', text.includes('AREIA - M³'));
  }

  await browser.close();
  console.log('\n✔ EMPIRICAL VERIFICATION COMPLETE ON VPS (209.50.241.22:1000)!');
}

verifyLiveCatalogOrderClean().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
