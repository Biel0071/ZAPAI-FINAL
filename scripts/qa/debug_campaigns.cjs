const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../../frontend-official/node_modules/playwright'));

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  const artifactDir = 'C:\\Users\\Dell\\.gemini\\antigravity\\brain\\578a7157-8bf3-47e3-82f2-9ed1bb8f9f40';

  console.log('Navigating to /login...');
  await page.goto('https://209.50.241.22:1000/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.locator('input[type="text"], #login-username').first().fill('zapadmin');
  await page.locator('input[type="password"], #login-password').first().fill('zapadmin1010');
  await page.click('button:has-text("Entrar"), button[type="submit"]');
  await page.waitForTimeout(3000);

  // Click on "Campanhas" in left sidebar
  console.log('Clicking "Campanhas" in sidebar...');
  await page.click('a[href="/campaigns"]');
  await page.waitForTimeout(5000);

  await page.screenshot({ path: path.join(artifactDir, 'debug_campaigns_screen.png') });
  console.log('Saved debug_campaigns_screen.png');

  const textContent = await page.innerText('body');
  console.log('Page body snippet:', textContent.slice(0, 500).replace(/\n/g, ' '));

  await browser.close();
}

main().catch(err => {
  console.error('Debug error:', err);
  process.exit(1);
});
