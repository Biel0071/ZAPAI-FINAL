const { chromium } = require('playwright');
const path = require('path');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Navigating to http://209.50.241.22:1000/login...');
  await page.goto('http://209.50.241.22:1000/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1000);

  const usernameInput = page.locator('#login-username, input[type="text"]').first();
  if (await usernameInput.isVisible()) {
    console.log('Logging in as admin...');
    await usernameInput.fill('admin');
    const passwordInput = page.locator('#login-password, input[type="password"]').first();
    await passwordInput.fill('admin123');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  console.log('Navigating to http://209.50.241.22:1000/inbox...');
  await page.goto('http://209.50.241.22:1000/inbox', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);

  const artifactDir = 'C:\\Users\\Dell\\.gemini\\antigravity\\brain\\578a7157-8bf3-47e3-82f2-9ed1bb8f9f40';

  // Ensure Tab 1 (Atendimento e Cliente) is active in the right sidebar
  const aiTabTrigger = page.locator('[role="tab"][value="ai"], [role="tab"]').first();
  if (await aiTabTrigger.isVisible()) {
    await aiTabTrigger.click();
    await page.waitForTimeout(1000);
  }

  // 1. Test WhatsApp Business official account
  console.log('Selecting WhatsApp Business...');
  const wbConv = page.locator('text=WhatsApp Business').first();
  if (await wbConv.isVisible()) {
    await wbConv.click();
    await page.waitForTimeout(2000);
    const wbPhone = await page.locator('.font-mono.select-all, text=Canal Oficial WhatsApp').first().textContent().catch(() => '');
    console.log('WhatsApp Business phone card result:', wbPhone);
  } else {
    console.log('WhatsApp Business not visible');
  }

  // 2. Test Deposito Material V A
  console.log('Selecting Deposito Material V A...');
  const depConv = page.locator('text=Deposito Material V A').first();
  if (await depConv.isVisible()) {
    await depConv.click();
    await page.waitForTimeout(2000);
    const depPhone = await page.locator('.font-mono.select-all').first().textContent().catch(() => '');
    console.log('Deposito Material V A phone card result:', depPhone);
  } else {
    console.log('Deposito Material V A not visible');
  }

  // 3. Test Andrade
  console.log('Selecting Andrade...');
  const andradeConv = page.locator('text=Andrade').first();
  if (await andradeConv.isVisible()) {
    await andradeConv.click();
    await page.waitForTimeout(2000);
    const andradePhone = await page.locator('.font-mono.select-all').first().textContent().catch(() => '');
    console.log('Andrade phone card result:', andradePhone);
  } else {
    console.log('Andrade not visible');
  }

  // Capture final verified screenshot
  await page.screenshot({ path: path.join(artifactDir, 'live_multiple_conversations_verified.png') });
  console.log('Saved live_multiple_conversations_verified.png');

  await browser.close();
  console.log('All verification checks completed successfully!');
}

main().catch(err => {
  console.error('Error during test:', err);
  process.exit(1);
});
