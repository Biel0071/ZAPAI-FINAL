const { chromium } = require('../../frontend-official/node_modules/playwright');
const path = require('path');

const ARTIFACT_DIR = 'C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--ignore-certificate-errors'] });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Navigating to https://209.50.241.22:1000/login...');
  await page.goto('https://209.50.241.22:1000/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const userInput = page.locator('#login-username');
  if (await userInput.isVisible()) {
    console.log('Filling credentials...');
    await userInput.fill('zapadmin');
    await page.locator('#login-password').fill('zapadmin1010');
    await page.locator('button[type="submit"]').click();
    console.log('Clicked submit, waiting for navigation...');
    await page.waitForTimeout(4000);
  }

  console.log('Navigating explicitly to /inbox...');
  await page.goto('https://209.50.241.22:1000/inbox', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(5000);
  console.log('Current URL:', page.url());

  // Click on Deposito Material V A chat if found
  const chatItem = page.locator('div, span, p').filter({ hasText: /Deposito Material V A/i }).first();
  if (await chatItem.count() > 0) {
    console.log('Clicking Deposito Material V A chat...');
    await chatItem.click();
    await page.waitForTimeout(3000);
  }

  // Evaluate UI states
  const uiState = await page.evaluate(() => {
    const textAll = document.body.innerText;
    const hasOfflineBanner = textAll.includes('Sessão WhatsApp Desconectada') || textAll.includes('WhatsApp desconectado · Mensagens');
    const hasOnlineBadge = textAll.includes('Online');
    const hasOfflineBadge = textAll.includes('Offline');
    
    // Check connection selector
    const select = document.querySelector('select');
    const selectedOption = select ? select.options[select.selectedIndex]?.text : null;
    const allOptions = select ? Array.from(select.options).map(o => o.text) : [];

    // Check textarea placeholder
    const textarea = document.querySelector('textarea');
    const placeholder = textarea ? textarea.getAttribute('placeholder') : null;

    // Check header bar texts
    const headerEl = document.querySelector('header');
    const headerText = headerEl ? headerEl.innerText : 'NO_HEADER';

    return {
      hasOfflineBanner,
      hasOnlineBadge,
      hasOfflineBadge,
      selectedOption,
      allOptions,
      placeholder,
      headerText,
    };
  });

  console.log('UI STATE INBOX:', JSON.stringify(uiState, null, 2));

  const inboxScreenshot = path.join(ARTIFACT_DIR, 'live_inbox_verified_online.png');
  await page.screenshot({ path: inboxScreenshot, fullPage: false });
  console.log('Saved inbox screenshot to:', inboxScreenshot);

  // Now verify Connections page
  console.log('Navigating to https://209.50.241.22:1000/connections...');
  await page.goto('https://209.50.241.22:1000/connections', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(4000);

  const connState = await page.evaluate(() => {
    const textAll = document.body.innerText;
    return {
      hasConectado: textAll.includes('Conectado'),
      hasDesconectado: textAll.includes('Desconectado'),
      bodySample: textAll.slice(0, 500)
    };
  });

  console.log('UI STATE CONNECTIONS:', JSON.stringify(connState, null, 2));

  const connScreenshot = path.join(ARTIFACT_DIR, 'live_connections_verified_online.png');
  await page.screenshot({ path: connScreenshot, fullPage: false });
  console.log('Saved connections screenshot to:', connScreenshot);

  await browser.close();
  console.log('Done verification!');
})();
