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
  await page.waitForTimeout(5000);

  const state = await page.evaluate(() => {
    const store = window.useAppStore ? window.useAppStore.getState() : null;
    const convs = (store?.conversations || []).map(c => ({ id: c.id, name: c.name, phone: c.phone, chatId: c.chatId }));
    return {
      activeId: store?.activeConversationId,
      totalConvs: convs.length,
      deposito: convs.filter(c => (c.name || '').toLowerCase().includes('deposito')),
      first10: convs.slice(0, 10)
    };
  });
  console.log('STATE:', JSON.stringify(state, null, 2));
  await browser.close();
})();

