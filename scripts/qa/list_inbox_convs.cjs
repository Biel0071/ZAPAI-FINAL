const { chromium } = require('../../frontend-official/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--ignore-certificate-errors'] });
  const page = await browser.newPage({ ignoreHTTPSErrors: true });
  await page.goto('https://209.50.241.22:1000/login');
  await page.locator('#login-username').fill('zapadmin');
  await page.locator('#login-password').fill('zapadmin1010');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3000);
  await page.goto('https://209.50.241.22:1000/inbox');
  await page.waitForTimeout(4000);

  const convs = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('[data-conversation-id]'));
    return rows.map(r => ({
      id: r.getAttribute('data-conversation-id'),
      text: r.textContent?.slice(0, 80)
    }));
  });

  console.log('Conversations count:', convs.length);
  console.log('Conversations:', JSON.stringify(convs.slice(0, 10), null, 2));
  await browser.close();
})();
