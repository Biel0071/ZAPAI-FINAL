const { chromium } = require('../../frontend-official/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--ignore-certificate-errors'] });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();

  page.on('response', async (res) => {
    if (res.url().includes('/api/conversations')) {
      console.log(`[NET] ${res.status()} ${res.url()}`);
    }
  });

  page.on('console', msg => {
    if (msg.text().includes('conversation') || msg.text().includes('message')) {
      console.log(`[CONSOLE] ${msg.text()}`);
    }
  });

  console.log('Navigating to http://209.50.241.22:1000/inbox...');
  await page.goto('http://209.50.241.22:1000/inbox', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Login
  const userInput = page.locator('input[placeholder*="Usuário" i], input[type="text"]').first();
  if (await userInput.isVisible()) {
    console.log('Logging in...');
    await userInput.fill('zapadmin');
    await page.locator('input[type="password"]').fill('zapadmin1010');
    await page.locator('button[type="submit"], button:has-text("Entrar")').first().click();
    await page.waitForTimeout(3000);
  }

  if (!page.url().includes('/inbox')) {
    await page.locator('a[href="/inbox"]').first().click();
    await page.waitForTimeout(3000);
  }

  // Find exact conversation row for Deposito in the sidebar
  console.log('Locating exact conversation row for Deposito...');
  const chatItem = page.locator('[data-testid="conversation-item"], .conversation-card, div').filter({ hasText: /^Deposito Material V A/i }).first();
  console.log('ChatItem visible:', await chatItem.isVisible());
  if (await chatItem.isVisible()) {
    const resPromise = page.waitForResponse(res => res.url().includes('/messages'), { timeout: 10000 }).catch(e => console.log('Wait messages error:', e.message));
    await chatItem.click();
    await resPromise;
    await page.waitForTimeout(3000);
  }

  const state = await page.evaluate(() => {
    const store = window.useAppStore ? window.useAppStore.getState() : null;
    const activeId = store ? store.activeConversationId : null;
    const msgs = store && activeId ? store.messagesByConversationId[activeId] || [] : [];
    const domBubbles = document.querySelectorAll('[data-message-id], [data-testid="whatsapp-product-card"], .message-bubble').length;
    const headerEl = document.querySelector('[data-testid="chat-header-profile"]');
    const headerTitle = headerEl ? headerEl.querySelector('h3')?.innerText : null;
    const headerSubtitle = headerEl ? headerEl.querySelector('span')?.innerText : null;
    const convInStore = store && activeId ? store.conversations?.find(c => String(c.id) === String(activeId)) : null;

    return {
      activeId,
      headerTitle,
      headerSubtitle,
      convInStoreName: convInStore?.name,
      convInStoreContactName: convInStore?.contactName,
      storeMessagesCount: msgs.length,
      domBubblesCount: domBubbles,
      hasEmptyState: document.body.innerText.includes('Nenhuma mensagem nesta conversa'),
    };
  });

  console.log('STATE:', JSON.stringify(state, null, 2));

  const screenshotPath = 'C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40/live_deposito_history_scrolled.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log('Saved screenshot to:', screenshotPath);

  // Now locate the 'Ver' button on the product card and click it
  console.log('Locating Ver button inside product card...');
  const verBtn = page.locator('[data-testid="whatsapp-product-card"] button').filter({ hasText: /^Ver$/i }).last();
  const verVisible = await verBtn.isVisible();
  console.log('Ver button visible:', verVisible);
  if (verVisible) {
    await verBtn.scrollIntoViewIfNeeded();
    await verBtn.click();
    await page.waitForTimeout(3000);

    const drawerInfo = await page.evaluate(() => {
      const drawer = document.querySelector('[data-testid="product-detail-drawer"]');
      if (!drawer) return { isOpen: false };
      const title = drawer.querySelector('h2')?.textContent || '';
      const imgs = Array.from(drawer.querySelectorAll('img')).map(i => i.src);
      const ths = drawer.querySelectorAll('button img');
      return {
        isOpen: true,
        title,
        totalImages: imgs.length,
        thumbnailsCount: ths.length,
        images: imgs
      };
    });
    console.log('DRAWER INFO:', JSON.stringify(drawerInfo, null, 2));

    const drawerScreenshot = 'C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40/live_deposito_drawer.png';
    await page.screenshot({ path: drawerScreenshot, fullPage: true });
    console.log('Saved drawer screenshot to:', drawerScreenshot);
  }

  await browser.close();
})();
