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
    await page.waitForTimeout(4000);
  }

  const items = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.conversation-card, [data-conversation-id], [role="button"], div'))
      .map(el => (el.textContent || '').trim().replace(/\s+/g, ' '))
      .filter(t => t.includes('Jota') || t.includes('Erica') || t.includes('Deposito') || t.includes('Edson') || t.includes('12574'))
      .slice(0, 10);
  });

  console.log('VISIBLE CHATS:', JSON.stringify(items, null, 2));
  await browser.close();
})();
