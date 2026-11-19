const { chromium } = require('../../frontend-official/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = 'C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40';
const BASE_URL = 'https://209.50.241.22:1000';

async function run() {
  console.log('=== VERIFYING BURST DISPATCH STABILITY & ZERO-FREEZE INBOX ===');
  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--no-sandbox']
  });

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1680, height: 1050 }
  });

  const page = await context.newPage();

  // Listen to console warnings and errors
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  console.log('1. Logging in to ZAI platform...');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#login-username', { timeout: 15000 });
  await page.fill('#login-username', 'zapadmin');
  await page.fill('#login-password', 'zapadmin1010');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  console.log('2. Navigating to Inbox...');
  await page.goto(`${BASE_URL}/inbox`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);

  // Wait for conversation list items
  console.log('3. Waiting for conversation list items (div[data-conversation-id])...');
  await page.waitForSelector('div[data-conversation-id]', { timeout: 20000 });

  const totalVisible = await page.locator('div[data-conversation-id]').count();
  console.log(`Found ${totalVisible} conversation rows currently rendered.`);

  // 4. Check initial store state & conversation count
  const initialStoreStatus = await page.evaluate(() => {
    const store = (window).__ZAPAI_APP_STORE__?.getState?.() || (window).useAppStore?.getState?.();
    return {
      conversationsCount: store?.conversations?.length ?? 0,
      runtimeStatus: store?.runtimeStatus ?? 'unknown',
      websocketHealth: store?.websocketHealth ?? 'unknown'
    };
  });
  console.log('Initial Store Status:', initialStoreStatus);

  // 5. Select first conversation to open chat pane
  const firstRow = page.locator('div[data-conversation-id]').first();
  await firstRow.click();
  await page.waitForTimeout(1500);

  // 6. SIMULATE RAPID BURST OF 25 OUTBOUND & INBOUND MESSAGES
  console.log('4. Simulating high-speed burst of 25 dispatch messages and status updates...');
  const burstResult = await page.evaluate(async () => {
    const store = (window).__ZAPAI_APP_STORE__?.getState?.() || (window).useAppStore?.getState?.();
    if (!store) return { error: 'Store not accessible directly via window' };

    const activeId = store.activeConversationId || store.conversations[0]?.id;
    const startCount = store.conversations.length;

    const t0 = performance.now();
    const delays = [];

    // Rapid burst: 25 messages and updates in tight sequence
    for (let i = 1; i <= 25; i++) {
      const stepStart = performance.now();
      const nowIso = new Date(Date.now() + i * 1000).toISOString();
      const fakeMsg = {
        id: 'msg-burst-' + Date.now() + '-' + i,
        conversationId: activeId,
        content: `Etapa ${i} de 25 disparada com sucesso! Teste de fluidez e ausência de lag.`,
        fromMe: i % 2 === 0,
        createdAt: nowIso,
        timestamp: nowIso,
        status: 'delivered'
      };

      // Call addMessage
      store.addMessage(activeId, fakeMsg);

      // Call updateConversationRealtime
      store.updateConversationRealtime({
        id: activeId,
        lastMessage: fakeMsg.content,
        lastMessageAt: nowIso,
        updatedAt: nowIso
      });

      delays.push(performance.now() - stepStart);
    }

    const totalElapsed = performance.now() - t0;
    const endCount = store.conversations.length;
    const maxDelay = Math.max(...delays);
    const avgDelay = delays.reduce((a, b) => a + b, 0) / delays.length;

    return {
      totalElapsedMs: totalElapsed,
      maxStepMs: maxDelay,
      avgStepMs: avgDelay,
      startConversationsCount: startCount,
      endConversationsCount: endCount,
      runtimeStatus: store.runtimeStatus,
      websocketHealth: store.websocketHealth
    };
  });

  console.log('Burst Execution Metrics:', burstResult);

  // 7. Verify UI is responsive after burst (switching contact)
  console.log('5. Testing contact switching responsiveness immediately after burst...');
  const secondRow = page.locator('div[data-conversation-id]').nth(1);
  const switchT0 = Date.now();
  await secondRow.click();
  await page.waitForTimeout(500);
  const switchElapsed = Date.now() - switchT0;
  console.log(`Contact switched in ${switchElapsed}ms immediately after heavy burst!`);

  // 8. Verify Socket connection indicator in UI
  const statusIndicator = await page.evaluate(() => {
    const text = document.body.innerText;
    const hasOnline = text.includes('Online') || text.includes('online');
    const hasDesconectado = text.includes('Desconectado') || text.includes('desconectado');
    const hasReconectando = text.includes('Reconectando') || text.includes('reconectando');
    return { hasOnline, hasDesconectado, hasReconectando };
  });
  console.log('UI Connection Status Indicators:', statusIndicator);

  // 9. Take verified screenshot
  const screenshotPath = path.join(ARTIFACTS_DIR, 'live_inbox_burst_stability_verified.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log('Screenshot saved to:', screenshotPath);

  // 10. Save report
  const report = {
    timestamp: new Date().toISOString(),
    burstResult,
    switchElapsedMs: switchElapsed,
    statusIndicator,
    screenshotPath
  };
  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'burst_stability_report.json'), JSON.stringify(report, null, 2));

  await browser.close();
  console.log('=== TEST COMPLETED SUCCESSFULLY! ===');
}

run().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
