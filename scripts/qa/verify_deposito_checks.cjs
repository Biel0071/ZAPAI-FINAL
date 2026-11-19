const { chromium } = require('../../frontend-official/node_modules/playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--ignore-certificate-errors'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  await page.goto('https://209.50.241.22:1000/login');
  await page.locator('#login-username').fill('zapadmin');
  await page.locator('#login-password').fill('zapadmin1010');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3000);
  await page.goto('https://209.50.241.22:1000/inbox');
  await page.waitForTimeout(3000);

  // Click on Deposito Material V A (id 12574)
  const depositoRow = page.locator('[data-conversation-id="12574"]').first();
  await depositoRow.click();
  await page.waitForTimeout(3000);

  const artifactDir = 'C:\\Users\\Dell\\.gemini\\antigravity\\brain\\578a7157-8bf3-47e3-82f2-9ed1bb8f9f40';
  await page.screenshot({ path: path.join(artifactDir, 'live_inbox_deposito_checks_verified.png') });
  console.log('Saved screenshot live_inbox_deposito_checks_verified.png');

  const checkDetails = await page.evaluate(() => {
    const checks = Array.from(document.querySelectorAll('[aria-label*="1V"], [aria-label*="2V"]')).map(el => ({
      label: el.getAttribute('aria-label'),
      title: el.getAttribute('title'),
      classes: el.getAttribute('class')
    }));
    return {
      totalFound: checks.length,
      sample: checks
    };
  });

  console.log('Checks in Deposito Material V A:', JSON.stringify(checkDetails, null, 2));
  await browser.close();
})();
