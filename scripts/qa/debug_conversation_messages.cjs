const { chromium } = require('../../frontend-official/node_modules/playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--ignore-certificate-errors'] });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const networkLogs = [];
  page.on('request', req => {
    if (req.url().includes('/messages') || req.url().includes('/conversations')) {
      networkLogs.push({ type: 'REQ', method: req.method(), url: req.url() });
    }
  });

  page.on('response', async res => {
    if (res.url().includes('/messages') || res.url().includes('/conversations')) {
      let bodyText = '';
      try { bodyText = (await res.text()).slice(0, 300); } catch (_) {}
      networkLogs.push({ type: 'RES', status: res.status(), url: res.url(), sample: bodyText });
    }
  });

  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[INBOX') || text.includes('error') || text.includes('Error') || text.includes('Messages') || text.includes('message')) {
      consoleLogs.push({ type: msg.type(), text });
    }
  });

  page.on('pageerror', err => {
    consoleLogs.push({ type: 'PAGE_ERROR', text: err.message, stack: err.stack });
  });

  console.log('Navigating to login...');
  await page.goto('https://209.50.241.22:1000/login');
  await page.locator('#login-username').fill('zapadmin');
  await page.locator('#login-password').fill('zapadmin1010');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(4000);

  console.log('Navigating to /inbox...');
  await page.goto('https://209.50.241.22:1000/inbox', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(4000);

  // Inspect store before click
  const stateBefore = await page.evaluate(() => {
    const store = window.useAppStore ? window.useAppStore.getState() : null;
    return {
      conversationsCount: store?.conversations?.length || 0,
      activeConversationId: store?.activeConversationId || null,
      firstConv: store?.conversations?.[0] ? { id: store.conversations[0].id, name: store.conversations[0].name, phone: store.conversations[0].phone } : null,
      messagesKeys: Object.keys(store?.messagesByConversationId || {}),
    };
  });
  console.log('STATE BEFORE CLICK:', JSON.stringify(stateBefore, null, 2));

  // Click on the first conversation item in the list
  const chatCards = page.locator('[data-testid="conversation-card"], .cursor-pointer').filter({ hasText: /Geise|Jota|Deposito|Andrade|Mariza/i });
  const count = await chatCards.count();
  console.log('Found conversation cards matching query:', count);

  if (count > 0) {
    const firstCard = chatCards.first();
    const cardText = (await firstCard.innerText()).split('\n')[0];
    console.log('Clicking on conversation card:', cardText);
    await firstCard.click();
    await page.waitForTimeout(4000);
  }

  // Inspect store after click
  const stateAfter = await page.evaluate(() => {
    const store = window.useAppStore ? window.useAppStore.getState() : null;
    const activeId = store?.activeConversationId;
    const activeConv = store?.conversations?.find(c => String(c.id) === String(activeId));
    const msgs = activeId ? (store?.messagesByConversationId?.[activeId] || []) : [];
    
    // Check DOM in active chat pane
    const activeChatPane = document.querySelector('[data-testid="active-chat-pane"]') || document.querySelector('.flex-1.flex-col');
    const messageRows = document.querySelectorAll('[data-testid="message-row"], [data-message-id]');
    const emptyState = document.body.innerText.includes('Nenhuma mensagem') || document.body.innerText.includes('Selecione uma conversa');

    return {
      activeId,
      activeConv: activeConv ? { id: activeConv.id, name: activeConv.name, phone: activeConv.phone } : null,
      activeMsgsCount: msgs.length,
      sampleMsg: msgs[0] ? { id: msgs[0].id, text: msgs[0].text || msgs[0].content, fromMe: msgs[0].fromMe } : null,
      renderedMessageRowsCount: messageRows.length,
      hasEmptyState: emptyState,
      visibleBodySnippet: document.body.innerText.slice(0, 400),
    };
  });
  console.log('STATE AFTER CLICK:', JSON.stringify(stateAfter, null, 2));

  console.log('--- NETWORK LOGS ---');
  console.log(JSON.stringify(networkLogs.slice(-15), null, 2));

  console.log('--- CONSOLE LOGS ---');
  console.log(JSON.stringify(consoleLogs.slice(-15), null, 2));

  const screenshotPath = path.join(ARTIFACT_DIR, 'live_inbox_messages_debug.png');
  await page.screenshot({ path: screenshotPath });
  console.log('Saved screenshot to:', screenshotPath);

  await browser.close();
})();
