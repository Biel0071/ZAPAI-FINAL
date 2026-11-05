const { chromium } = require('../../frontend-official/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--ignore-certificate-errors'] });
  const page = await browser.newPage();
  await page.goto('http://209.50.241.22:1000/inbox', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const u = page.locator('input[type=text]').first();
  if (await u.isVisible()) {
    await u.fill('zapadmin');
    await page.locator('input[type=password]').fill('zapadmin1010');
    await page.locator('button[type=submit]').click();
    await page.waitForTimeout(3000);
  }
  if (!page.url().includes('/inbox')) {
    await page.locator('a[href="/inbox"]').first().click();
    await page.waitForTimeout(3000);
  }
  const c = await page.evaluate(() => {
    const s = window.useAppStore ? window.useAppStore.getState() : null;
    if (!s) return { error: 'no store' };
    const all = s.conversations.map(x => ({ id: x.id, name: x.name, contactName: x.contactName, phone: x.phone }));
    const match = s.conversations.find(x => String(x.id) === '12574' || (x.name && x.name.includes('Deposito')));
    return {
      total: all.length,
      match,
      first5: all.slice(0, 5),
    };
  });
  console.log('CONVERSATION:', JSON.stringify(c, null, 2));
  await browser.close();
})();
