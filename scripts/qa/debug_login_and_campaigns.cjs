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

  console.log('1. Navigating to login...');
  await page.goto('https://209.50.241.22:1000/login', { waitUntil: 'networkidle', timeout: 30000 });
  await page.screenshot({ path: path.join(artifactDir, 'debug_login_initial.png') });

  console.log('2. Filling credentials...');
  await page.fill('#login-username', 'zapadmin');
  await page.fill('#login-password', 'zapadmin1010');
  await page.click('button:has-text("Entrar")');
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(artifactDir, 'debug_after_entrar.png') });
  console.log('Current URL after entrar:', page.url());

  console.log('3. Navigating to campaigns...');
  await page.goto('https://209.50.241.22:1000/campaigns', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(artifactDir, 'debug_campaigns_loaded.png') });
  console.log('Current URL on campaigns:', page.url());

  const pageText = await page.innerText('body');
  console.log('Page body snippet:', pageText.slice(0, 300).replace(/\n/g, ' '));

  await browser.close();
}

main().catch(err => {
  console.error('Debug error:', err);
  process.exit(1);
});
