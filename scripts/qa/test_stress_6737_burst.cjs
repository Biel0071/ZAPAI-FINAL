const { chromium } = require('../../frontend-official/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = 'C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40';
const BASE_URL = 'https://209.50.241.22:1000';

async function run() {
  console.log('=== BENCHMARKING BURST PERFORMANCE ON 6,737 ITEMS ===');
  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--no-sandbox']
  });

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1680, height: 1050 }
  });

  const page = await context.newPage();

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

  // Directly set 6,737 items in Zustand and benchmark 30 burst dispatches
  const stress = await page.evaluate(async () => {
    const store = (window).useAppStore?.getState?.();
    if (!store) return { error: 'No store' };

    const synthetic = [];
    for (let i = 0; i < 6737; i++) {
      synthetic.push({
        id: 'conv-stress-' + i,
        phone: '55319' + String(i).padStart(8, '0'),
        chatId: '55319' + String(i).padStart(8, '0') + '@s.whatsapp.net',
        contactName: 'Contato ' + i,
        sessionId: 'main',
        unread: 0,
        lastMessage: 'Mensagem ' + i,
        lastMessageAt: '2026-11-10T10:00:00Z',
        updatedAt: '2026-11-10T10:00:00Z',
        status: 'offline'
      });
    }

    // Benchmark setConversations on 6737 items
    const tSet0 = performance.now();
    (window).useAppStore.setState({ conversations: synthetic });
    const setConversationsTime = performance.now() - tSet0;

    const currentConvs = (window).useAppStore.getState().conversations;
    const targetConv = currentConvs[0];
    const targetId = targetConv.id;

    // Benchmark 30 burst messages arriving in rapid succession on 6,737 items
    const tBurst0 = performance.now();
    const stepTimes = [];

    for (let step = 1; step <= 30; step++) {
      const stepStart = performance.now();
      const timestamp = new Date(Date.now() + step * 500).toISOString();
      const msg = {
        id: 'stress-msg-' + Date.now() + '-' + step,
        conversationId: targetId,
        content: `CHURRAS Etapa ${step} de 30 - foto enviada`,
        fromMe: true,
        mediaType: step % 2 === 0 ? 'image' : 'text',
        createdAt: timestamp,
        timestamp: timestamp,
        status: 'delivered'
      };

      (window).useAppStore.getState().addMessage(targetId, msg);
      (window).useAppStore.getState().updateConversationRealtime({
        id: targetId,
        lastMessage: msg.content,
        lastMessageAt: timestamp,
        updatedAt: timestamp
      });

      stepTimes.push(performance.now() - stepStart);
    }

    const totalBurstTime = performance.now() - tBurst0;
    const maxStep = Math.max(...stepTimes);
    const avgStep = stepTimes.reduce((a, b) => a + b, 0) / stepTimes.length;
    const finalState = (window).useAppStore.getState();

    return {
      conversationsCount: finalState.conversations.length,
      setConversationsTimeMs: setConversationsTime,
      totalBurstTimeMs: totalBurstTime,
      avgStepMs: avgStep,
      maxStepMs: maxStep,
      runtimeStatus: finalState.runtimeStatus,
      websocketHealth: finalState.websocketHealth
    };
  });

  console.log('=== 6,737 ITEMS EMPIRICAL BENCHMARK RESULT ===');
  console.log(JSON.stringify(stress, null, 2));

  // Check UI connection indicator
  const statusCheck = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      hasOnline: text.includes('Online') || text.includes('online'),
      hasDesconectado: text.includes('Desconectado') || text.includes('desconectado'),
      hasReconectando: text.includes('Reconectando') || text.includes('reconectando')
    };
  });
  console.log('UI Connection Indicators:', statusCheck);

  const screenshotPath = path.join(ARTIFACTS_DIR, 'live_inbox_6737_burst_verified.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log('Screenshot saved to:', screenshotPath);

  await browser.close();
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
