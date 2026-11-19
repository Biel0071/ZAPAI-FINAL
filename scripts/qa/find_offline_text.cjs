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
  const elementsWithOffline = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*'))
      .filter(el => el.children.length === 0 && (el.innerText || '').toLowerCase().includes('offline'))
      .map(el => ({ tag: el.tagName, text: el.innerText, parent: el.parentElement?.tagName, className: el.className }));
  });
  console.log('ELEMENTS WITH OFFLINE:', JSON.stringify(elementsWithOffline, null, 2));
  await browser.close();
})();

