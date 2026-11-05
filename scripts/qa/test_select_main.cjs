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

  await page.goto('https://209.50.241.22:1000/inbox', { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(4000);

  // Check select in header
  const select = page.locator('header select').first();
  if (await select.count() > 0) {
    console.log('Selecting main in header...');
    await select.selectOption('main');
    await page.waitForTimeout(3000);
  }

  // Click on Deposito Material V A chat
  const chatItem = page.locator('div, span, p').filter({ hasText: /Deposito Material V A/i }).first();
  if (await chatItem.count() > 0) {
    await chatItem.click();
    await page.waitForTimeout(2000);
  }

  const result = await page.evaluate(() => {
    const textAll = document.body.innerText;
    return {
      hasOfflineBanner: textAll.includes('Sessão WhatsApp Desconectada') || textAll.includes('WhatsApp desconectado'),
      hasOnlineBadge: textAll.includes('Online'),
      headerOnline: document.querySelector('header')?.innerText.includes('Online'),
      textareaPlaceholder: document.querySelector('textarea')?.getAttribute('placeholder'),
    };
  });

  console.log('RESULT WITH MAIN SELECTED:', JSON.stringify(result, null, 2));

  const screenshotPath = path.join(ARTIFACT_DIR, 'live_inbox_main_selected_online.png');
  await page.screenshot({ path: screenshotPath });
  console.log('Saved screenshot to:', screenshotPath);

  await browser.close();
})();

