const { chromium } = require('../../frontend-official/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--ignore-certificate-errors'] });
  const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1100 } });
  await page.goto('http://209.50.241.22:1000/inbox', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const u = page.locator('input[type="text"]').first();
  if (await u.isVisible()) {
    await u.fill('zapadmin');
    await page.locator('input[type="password"]').fill('zapadmin1010');
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(3000);
  }

  if (!page.url().includes('/inbox')) {
    await page.goto('http://209.50.241.22:1000/inbox', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
  }

  await page.waitForTimeout(3000);
  console.log('Current URL:', page.url());

  const titles = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*'))
      .map(el => el.textContent?.trim())
      .filter(t => t && (t.includes('Deposito') || t.includes('Jota') || t.includes('Erica')))
      .slice(0, 10);
  });
  console.log('Found titles:', titles);

  // Click conversation item
  const chatItem = page.locator('div, span, p').filter({ hasText: /Deposito Material V A/i }).first();
  console.log('ChatItem count:', await chatItem.count());
  if (await chatItem.count() > 0) {
    await chatItem.click();
    await page.waitForTimeout(3000);
  }

  const headerInfo = await page.evaluate(() => {
    const profile = document.querySelector('[data-testid="chat-header-profile"]');
    const headerTitle = profile ? profile.querySelector('h3')?.innerText : 'NO PROFILE';
    const store = window.useAppStore ? window.useAppStore.getState() : null;
    const active = store ? store.activeConversationId : null;
    const conv = store && active ? store.conversations?.find(c => String(c.id) === String(active)) : null;
    return {
      headerTitle,
      active,
      convName: conv?.name,
      convContactName: conv?.contactName,
      convPhone: conv?.phone,
      allHeaderTexts: profile?.innerText
    };
  });

  console.log('HEADER INFO:', JSON.stringify(headerInfo, null, 2));
  await page.screenshot({ path: 'C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40/inspect_debug.png' });
  await browser.close();
})();
