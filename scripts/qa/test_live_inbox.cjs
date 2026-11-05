const { chromium } = require('../../frontend-official/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--ignore-certificate-errors'] });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const networkLogs = [];
  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('/api/conversations') || url.includes('/assets/catalog')) {
      let bodyText = '';
      try {
        bodyText = (await res.text()).slice(0, 200);
      } catch (_) {}
      networkLogs.push({ url, status: res.status(), bodyText });
    }
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.text().includes('conversation') || msg.text().includes('message')) {
      console.log(`[BROWSER CONSOLE ${msg.type()}]`, msg.text().slice(0, 150));
    }
  });

  console.log('Navigating to http://209.50.241.22:1000/inbox...');
  await page.goto('http://209.50.241.22:1000/inbox', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // Check if login needed
  const userInput = page.locator('input[placeholder*="Usuário" i], input[type="text"]').first();
  if (await userInput.isVisible()) {
    console.log('Logging in...');
    await userInput.fill('zapadmin');
    await page.locator('input[type="password"]').fill('zapadmin1010');
    await page.locator('button[type="submit"], button:has-text("Entrar")').first().click();
    await page.waitForTimeout(3000);
  }

  // Click on Inbox in sidebar if not on inbox
  if (!page.url().includes('/inbox')) {
    console.log('Clicking on Inbox menu item in sidebar...');
    await page.locator('a[href="/inbox"], button:has-text("Inbox")').first().click();
    await page.waitForTimeout(3000);
  }

  // Click on Deposito Material V A
  console.log('Searching for Deposito Material V A in conversation list...');
  const depositoItem = page.locator('div, span, p').filter({ hasText: /^Deposito Material V A$/i }).first();
  if (await depositoItem.isVisible()) {
    console.log('Found Deposito Material V A! Clicking...');
    const messageResponsePromise = page.waitForResponse(res => res.url().includes('/api/conversations/12574/messages'), { timeout: 15000 }).catch(e => console.log('Messages response wait failed:', e.message));
    await depositoItem.click();
    await messageResponsePromise;
    await page.waitForTimeout(3000);
  } else {
    console.log('Deposito Material V A item not found directly, looking for partial match...');
    const partial = page.locator('text=/Deposito Material/i').first();
    if (await partial.isVisible()) {
      await partial.click();
      await page.waitForTimeout(3000);
    }
  }

  // Inspect state inside the browser page
  const debugInfo = await page.evaluate(() => {
    const store = window.useAppStore ? window.useAppStore.getState() : null;
    const activeId = store ? store.activeConversationId : null;
    const convs = store ? store.conversations : [];
    const activeConv = convs.find(c => c.id === activeId || c.name?.includes('Deposito'));
    const messages = store && activeConv ? store.messagesByConversationId[activeConv.id] || [] : [];
    
    // Check DOM message bubbles
    const bubbles = Array.from(document.querySelectorAll('[data-message-id], .message-bubble, .chat-message, [role="row"], .group\\/message'))
      .map(el => (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80));

    // Also get all div elements in the chat area that contain text
    const chatContainer = document.querySelector('.overflow-y-auto, [data-chat-scroll="true"]');
    const scrollInfo = chatContainer ? {
      scrollHeight: chatContainer.scrollHeight,
      clientHeight: chatContainer.clientHeight,
      scrollTop: chatContainer.scrollTop,
    } : null;
    
    // Check images in chat
    const images = Array.from(document.querySelectorAll('img'))
      .map(img => ({ src: img.src, naturalWidth: img.naturalWidth, complete: img.complete }))
      .filter(img => img.src.includes('catalog') || img.src.includes('bloco') || img.src.includes('areia'));

    // Check if Indisponível is visible
    const hasIndisponivel = document.body.innerText.includes('Indisponível');

    return {
      activeId,
      activeConv: activeConv ? { id: activeConv.id, name: activeConv.name, phone: activeConv.phone } : null,
      messagesCountInStore: messages.length,
      bubblesCountInDOM: bubbles.length,
      bubblesSample: bubbles.slice(-10),
      scrollInfo,
      images,
      hasIndisponivel
    };
  });

  console.log('--- DEBUG INFO FROM BROWSER ---');
  console.log(JSON.stringify(debugInfo, null, 2));

  console.log('--- NETWORK LOGS ---');
  for (const n of networkLogs) {
    console.log(`${n.status} ${n.url} -> ${n.bodyText}`);
  }

  const screenshotPath = 'C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40/live_deposito_test.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log('Saved screenshot to:', screenshotPath);

  await browser.close();
})();
