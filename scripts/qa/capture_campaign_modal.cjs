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

  console.log('1. Logging in...');
  await page.goto('https://209.50.241.22:1000/login', { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('#login-username', 'zapadmin');
  await page.fill('#login-password', 'zapadmin1010');
  await page.click('button:has-text("Entrar")');
  await page.waitForTimeout(3000);

  console.log('2. Navigating to /campaigns...');
  await page.goto('https://209.50.241.22:1000/campaigns', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  console.log('3. Opening "Importar Contatos" dropdown...');
  const importBtn = page.locator('button:has-text("Importar Contatos")').first();
  await importBtn.click();
  await page.waitForTimeout(1000);

  console.log('4. Clicking "Filtrar por Etiquetas / Tags"...');
  await page.click('text=Filtrar por Etiquetas / Tags');
  await page.waitForTimeout(2500);

  console.log('5. Waiting for modal...');
  await page.waitForSelector('text=Selecionar por Etiqueta WhatsApp', { timeout: 10000 });

  // Count badges
  const badges = await page.locator('div[role="dialog"] button:has(span.rounded-full)').all();
  console.log(`Rendered label badges: ${badges.length}`);

  // Click on a couple of badges to show active selection state in screenshot
  if (badges.length > 0) {
    console.log('Clicking first label badge...');
    await badges[0].click();
    await page.waitForTimeout(500);
  }
  if (badges.length > 1) {
    console.log('Clicking second label badge...');
    await badges[1].click();
    await page.waitForTimeout(500);
  }

  await page.screenshot({ path: path.join(artifactDir, 'live_campaign_real_labels_selector.png') });
  console.log('Saved live_campaign_real_labels_selector.png successfully!');

  await browser.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
