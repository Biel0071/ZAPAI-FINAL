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

  const found = await page.evaluate(() => {
    const store = window.useAppStore ? window.useAppStore.getState() : null;
    return (store?.conversations || []).filter(c =>
      (c.name && c.name.toLowerCase().includes('deposito')) ||
      (c.phone && c.phone.includes('9367')) ||
      (c.phone && c.phone.includes('2075')) ||
      String(c.id) === '12574'
    ).map(c => ({ id: c.id, name: c.name, phone: c.phone, chatId: c.chatId }));
  });
  console.log('FOUND:', JSON.stringify(found, null, 2));

  console.log('Searching for Deposito in sidebar...');
  const searchInput = page.locator('input[placeholder*="Buscar conversas"], input[placeholder*="Buscar"]').first();
  await searchInput.fill('Deposito');
  await page.waitForTimeout(2000);

  const row = page.locator('[data-conversation-id="12574"], .inbox-message:has-text("Deposito")').first();
  console.log('Row count after search:', await row.count());

  if (await row.count() > 0) {
    console.log('Clicking Deposito row...');
    await row.click();
    await page.waitForTimeout(5000);

    const msgs = await page.evaluate(() => {
      const store = window.useAppStore.getState();
      const id = store.activeConversationId;
      const m = store.messagesByConversationId?.[String(id)] || [];
      const domBubbles = document.querySelectorAll('.chat-bubble, [data-testid="whatsapp-product-card"]');
      return {
        activeId: id,
        storeMsgsCount: m.length,
        domBubblesCount: domBubbles.length,
        first5: m.slice(0, 5).map(x => ({ id: x.id, content: x.content?.slice(0, 40), mediaType: x.mediaType, type: x.type }))
      };
    });
    console.log('MESSAGES RESULT:', JSON.stringify(msgs, null, 2));

    const screenshotPath = 'C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40/live_deposito_direct_verified.png';
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log('Saved screenshot:', screenshotPath);
  } else {
    console.log('Row not found via search filter.');
  }

  await browser.close();
})();
