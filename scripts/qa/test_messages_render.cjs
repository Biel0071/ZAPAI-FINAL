const { chromium } = require('../../frontend-official/node_modules/playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--ignore-certificate-errors'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });

  const messagesReqs = [];
  page.on('request', r => {
    if (r.url().includes('/messages')) {
      messagesReqs.push({ method: r.method(), url: r.url() });
    }
  });
  page.on('response', async res => {
    if (res.url().includes('/messages')) {
      messagesReqs.push({ status: res.status(), url: res.url() });
    }
  });

  await page.goto('https://209.50.241.22:1000/login');
  await page.locator('#login-username').fill('zapadmin');
  await page.locator('#login-password').fill('zapadmin1010');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3000);
  await page.goto('https://209.50.241.22:1000/inbox');
  await page.waitForTimeout(3000);

  console.log('Clicking Deposito Material V A...');
  await page.locator('[data-conversation-id="12574"]').first().click();

  // Wait until skeletons are gone or message row appears
  console.log('Waiting for messages to render...');
  await page.waitForFunction(() => {
    const bubbles = document.querySelectorAll('[data-message-id], time, [aria-label*="1V"], [aria-label*="2V"]');
    return bubbles.length > 0;
  }, { timeout: 15000 }).catch(e => console.log('Wait timed out or finished:', e.message));

  await page.waitForTimeout(1000);

  const artifactDir = 'C:\\Users\\Dell\\.gemini\\antigravity\\brain\\578a7157-8bf3-47e3-82f2-9ed1bb8f9f40';
  await page.screenshot({ path: path.join(artifactDir, 'live_inbox_messages_rendered.png') });
  console.log('Saved screenshot live_inbox_messages_rendered.png');

  const checkElements = await page.evaluate(() => {
    const list = Array.from(document.querySelectorAll('time, svg, span, [aria-label]'))
      .map(el => ({
        tag: el.tagName,
        ariaLabel: el.getAttribute('aria-label'),
        title: el.getAttribute('title'),
        className: el.getAttribute('class')
      }))
      .filter(x => x.ariaLabel && (x.ariaLabel.includes('1V') || x.ariaLabel.includes('2V') || x.ariaLabel.includes('Enviad') || x.ariaLabel.includes('Lid') || x.ariaLabel.includes('Entreg')));

    return {
      messagesNetworkLogs: window.__messagesReqs || [],
      matchedChecks: list
    };
  });

  console.log('Network logs for /messages:', messagesReqs);
  console.log('Checks found on rendered messages:', checkElements.matchedChecks);

  await browser.close();
})();
