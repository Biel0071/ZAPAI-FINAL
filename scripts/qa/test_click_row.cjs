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

  const row = page.locator('[data-conversation-id="12574"], [data-conversation-id="17061"]').first();
  console.log('Row count:', await row.count());
  if (await row.count() > 0) {
    const id = await row.getAttribute('data-conversation-id');
    console.log('Clicking row with conversation id:', id);
    await row.click();
    await page.waitForTimeout(4000);
  }

  const result = await page.evaluate(() => {
    const store = window.useAppStore ? window.useAppStore.getState() : null;
    const activeId = store?.activeConversationId;
    const msgs = activeId ? (store?.messagesByConversationId?.[activeId] || []) : [];
    const domMessages = document.querySelectorAll('[data-message-id], .message-bubble, .inbox-message');
    return {
      activeId,
      storeMsgsCount: msgs.length,
      first3Msgs: msgs.slice(0, 3).map(m => ({ id: m.id, content: m.content?.slice(0, 30) })),
      centerText: document.querySelector('main, .flex-1.flex-col')?.innerText?.slice(0, 300)
    };
  });
  console.log('CLICK RESULT:', JSON.stringify(result, null, 2));
  await browser.close();
})();

