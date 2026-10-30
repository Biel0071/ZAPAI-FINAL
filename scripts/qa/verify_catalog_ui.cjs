const { chromium } = require('../../frontend-official/node_modules/playwright');
const path = require('path');
const fs = require('fs');

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

  console.log('Navigating to login...');
  await page.goto('https://209.50.241.22:1000/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#login-username', { timeout: 10000 });

  // Fill login
  await page.fill('#login-username', 'zapadmin');
  await page.fill('#login-password', 'zapadmin1010');
  
  // Click submit and wait for navigation
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(3000);

  console.log('Navigating to inbox...');
  await page.goto('https://209.50.241.22:1000/inbox', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);

  // Take screenshot of inbox
  await page.screenshot({ path: path.join(__dirname, 'evidence_inbox_full.png') });
  console.log('Saved evidence_inbox_full.png');
  await page.screenshot({ path: path.join(__dirname, 'evidence_inbox_initial.png') });
  console.log('Screenshot saved to evidence_inbox_initial.png');

  // Let's see what is visible
  const bodyText = await page.innerText('body');
  console.log('Body text snippet:', bodyText.slice(0, 300).replace(/\n+/g, ' '));

  // Take screenshot of the composer area
  const composerArea = page.locator('div:has(> [data-catalog-trigger])').first();
  await page.screenshot({ path: path.join(__dirname, 'evidence_inbox_full.png') });

  // Locate the catalog trigger button
  const catalogBtn = page.locator('[data-catalog-trigger]');
  const isVisible = await catalogBtn.isVisible();
  console.log('Catalog trigger button visible:', isVisible);

  const emojiBtn = page.locator('[data-emoji-trigger]');
  console.log('Emoji button visible:', await emojiBtn.isVisible());

  // Crop the composer bar
  const composerBox = await page.locator('[data-catalog-trigger]').boundingBox();
  console.log('Catalog button bounding box:', composerBox);

  // Click catalog button to open popover
  console.log('Clicking catalog trigger button...');
  await catalogBtn.click();
  await page.waitForTimeout(1000);

  // Take screenshot with popover open
  await page.screenshot({ path: path.join(__dirname, 'evidence_catalog_open.png') });

  // Count product items in popover
  const productItems = await page.locator('[data-catalog-popover] .cursor-pointer').count();
  console.log('Product items rendered in popover:', productItems);

  await browser.close();
  console.log('Verification completed successfully!');
}

run().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
