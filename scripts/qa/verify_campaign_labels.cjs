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

  console.log('Navigating to /campaigns directly...');
  await page.goto('https://209.50.241.22:1000/campaigns', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  // If redirected to login, perform login
  if (page.url().includes('/login')) {
    console.log('On login page, logging in as zapadmin...');
    await page.waitForSelector('input[type="text"], #login-username');
    await page.locator('input[type="text"], #login-username').first().fill('zapadmin');
    await page.locator('input[type="password"], #login-password').first().fill('zapadmin1010');
    await page.click('button:has-text("Entrar"), button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3000);
  }

  // Ensure on /campaigns
  if (!page.url().includes('/campaigns')) {
    console.log('Navigating to /campaigns...');
    await page.goto('https://209.50.241.22:1000/campaigns', { waitUntil: 'domcontentloaded', timeout: 30000 });
  }

  console.log('Waiting for Campaigns UI to render...');
  await page.waitForSelector('button:has-text("Importar Contatos")', { timeout: 25000 });
  console.log('Found "Importar Contatos" button!');
  
  const importBtn = page.locator('button:has-text("Importar Contatos")').first();
  await importBtn.click();
  console.log('Clicked "Importar Contatos" dropdown...');
  await page.waitForTimeout(1000);

  console.log('Clicking "Filtrar por Etiquetas / Tags"...');
  await page.waitForSelector('text=Filtrar por Etiquetas / Tags', { timeout: 10000 });
  await page.locator('text=Filtrar por Etiquetas / Tags').first().click();

  console.log('Waiting for modal "Selecionar por Etiqueta WhatsApp"...');
  await page.waitForSelector('text=Selecionar por Etiqueta WhatsApp', { timeout: 10000 });
  await page.waitForTimeout(1500);

  // Check badges
  const badges = await page.locator('div[role="dialog"] button:has(span.rounded-full)').all();
  console.log(`Rendered label badges count: ${badges.length}`);
  for (let i = 0; i < badges.length; i++) {
    const text = await badges[i].innerText();
    console.log(`Badge ${i + 1}: ${text.replace(/\n/g, ' ')}`);
  }

  // Click first badge if available
  if (badges.length > 0) {
    console.log('Clicking badge 1...');
    await badges[0].click();
    await page.waitForTimeout(800);
  }

  await page.screenshot({ path: path.join(artifactDir, 'live_campaign_real_labels_selector.png') });
  console.log('Saved live_campaign_real_labels_selector.png successfully!');

  await browser.close();
  console.log('=== VERIFICATION OF CAMPAIGN LABELS COMPLETE ===');
}

main().catch(err => {
  console.error('Campaign verify error:', err);
  process.exit(1);
});
