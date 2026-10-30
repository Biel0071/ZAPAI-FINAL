'use strict';
const playwright = require('playwright-core');

(async () => {
  try {
    console.log('[TEST] Launching Chromium persistent context...');
    const sessionDataDir = '/opt/zapai/backend/.web_bridge_sessions/default/main';
    const browserContext = await playwright.chromium.launchPersistentContext(sessionDataDir, {
      executablePath: '/usr/bin/chromium-browser',
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1280,800',
      ],
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 }
    });

    const page = browserContext.pages().length > 0 ? browserContext.pages()[0] : await browserContext.newPage();
    console.log('[TEST] Navigating to https://web.whatsapp.com...');
    await page.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded', timeout: 45000 });
    console.log('[TEST] Initial DOM ready. Waiting for WhatsApp React App hydration...');

    let found = false;
    for (let i = 1; i <= 10; i++) {
      await page.waitForTimeout(3000);
      const title = await page.title();
      const hasChat = await page.$('#pane-side, [data-testid="chat-list"]');
      const hasCanvas = await page.$('canvas');
      const hasRef = await page.$('[data-ref]');
      const textLen = (await page.evaluate(() => document.body.innerText)).length;
      console.log(`[TEST][${i * 3}s] Title="${title}" | ChatList=${!!hasChat} | Canvas=${!!hasCanvas} | data-ref=${!!hasRef} | TextLength=${textLen}`);

      if (hasChat || hasCanvas || hasRef) {
        found = true;
        if (hasCanvas) {
          const qrData = await page.evaluate(() => {
            const c = document.querySelector('canvas');
            return c ? c.toDataURL('image/png') : null;
          });
          console.log('[TEST] QR Code DataURL length:', qrData ? qrData.length : 0);
          const refVal = await page.evaluate(() => {
            const el = document.querySelector('[data-ref]');
            return el ? el.getAttribute('data-ref') : null;
          });
          console.log('[TEST] data-ref value:', refVal);
        }
        await page.screenshot({ path: '/tmp/wa_web_active.png' });
        console.log('[TEST] Screenshot captured at /tmp/wa_web_active.png');
        break;
      }
    }

    if (!found) {
      console.log('[TEST] Did not find canvas or chat within 30s. Taking fallback screenshot...');
      await page.screenshot({ path: '/tmp/wa_web_timeout.png' });
      const body = await page.evaluate(() => document.body.innerText);
      console.log('[TEST] Full body:', body.slice(0, 500));
    }

    await browserContext.close();
    console.log('[TEST] Finished.');
  } catch (err) {
    console.error('[TEST] Error:', err);
    process.exit(1);
  }
})();
