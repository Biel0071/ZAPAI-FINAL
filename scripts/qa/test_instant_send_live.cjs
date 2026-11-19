const { chromium } = require('../../frontend-official/node_modules/playwright');
const path = require('path');

(async () => {
  console.log('Launching browser to test instant send on live VPS...');
  const browser = await chromium.launch({ headless: true, args: ['--ignore-certificate-errors'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });

  await page.goto('https://209.50.241.22:1000/login');
  await page.locator('#login-username').fill('zapadmin');
  await page.locator('#login-password').fill('zapadmin1010');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3000);

  await page.goto('https://209.50.241.22:1000/inbox');
  await page.waitForTimeout(3000);

  // Click on Deposito Material V A
  const row = page.locator('[data-conversation-id="12574"]').first();
  await row.click();
  await page.waitForTimeout(2000);

  // Check composer textarea
  const textarea = page.locator('textarea, input[placeholder*="Mensagem"]').first();
  await textarea.fill('Teste de envio instantaneo 0ms');

  const tBefore = Date.now();
  // Press Enter
  await textarea.press('Enter');
  const tSendTrigger = Date.now() - tBefore;

  // Immediately check textarea value
  const valAfterSend = await textarea.inputValue().catch(() => '');
  console.log(`Input cleared immediately? Value: "${valAfterSend}" (should be empty)`);

  // Wait 500ms and check if bubble appeared
  await page.waitForTimeout(500);
  const bubbleFound = await page.locator('text=Teste de envio instantaneo 0ms').count();
  console.log(`Optimistic message bubble present in chat? Count: ${bubbleFound}`);

  const artifactDir = 'C:\\Users\\Dell\\.gemini\\antigravity\\brain\\578a7157-8bf3-47e3-82f2-9ed1bb8f9f40';
  await page.screenshot({ path: path.join(artifactDir, 'live_instant_send_verified.png') });
  console.log('Saved screenshot live_instant_send_verified.png');

  await browser.close();
  console.log('Instant send live test complete!');
})();
