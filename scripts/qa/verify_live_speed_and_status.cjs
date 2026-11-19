const { chromium } = require('../../frontend-official/node_modules/playwright');
const path = require('path');

async function run() {
  console.log('Launching browser to test live inbox with real login...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--no-sandbox']
  });
  const page = await browser.newPage({ ignoreHTTPSErrors: true });

  await page.goto('https://209.50.241.22:1000/login');
  await page.locator('#login-username').fill('zapadmin');
  await page.locator('#login-password').fill('zapadmin1010');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3000);

  console.log('Navigating to https://209.50.241.22:1000/inbox ...');
  const t0 = Date.now();
  await page.goto('https://209.50.241.22:1000/inbox');
  await page.waitForTimeout(3000);
  console.log(`Inbox loaded in ${Date.now() - t0}ms`);

  const artifactDir = 'C:\\Users\\Dell\\.gemini\\antigravity\\brain\\578a7157-8bf3-47e3-82f2-9ed1bb8f9f40';
  await page.screenshot({ path: path.join(artifactDir, 'live_inbox_speed_verified.png') });
  console.log('Saved screenshot live_inbox_speed_verified.png');

  // Verify conversation rows
  const conversationRows = await page.locator('[data-conversation-id]').count();
  console.log(`Loaded conversation rows: ${conversationRows}`);

  // Click Andrade or first conversation
  const andradeRow = page.locator('text=Andrade').first();
  if (await andradeRow.count() > 0) {
    console.log('Clicking Andrade conversation...');
    await andradeRow.click();
    await page.waitForTimeout(2000);
  } else {
    console.log('Clicking first conversation row...');
    await page.locator('[data-conversation-id]').first().click();
    await page.waitForTimeout(2000);
  }

  // Check if "Nenhuma mensagem nesta conversa" is showing
  const emptyStateCount = await page.locator('text=Nenhuma mensagem nesta conversa').count();
  console.log(`Empty state count: ${emptyStateCount} (0 means real messages loaded without empty-flash bug)`);

  // Count checkmarks in the DOM
  const checkmarks1vCinza = await page.locator('[aria-label*="1V Cinza"]').count();
  const checkmarks2vCinza = await page.locator('[aria-label*="2V Cinza"]').count();
  const checkmarks2vVerde = await page.locator('[aria-label*="2V Verde"]').count();
  const checkmarks1vVermelho = await page.locator('[aria-label*="1V Vermelho"]').count();

  console.log(`Status Checkmarks in conversation:`);
  console.log(`- 1V Cinza (Enviado): ${checkmarks1vCinza}`);
  console.log(`- 2V Cinza (Entregue): ${checkmarks2vCinza}`);
  console.log(`- 2V Verde (Lido): ${checkmarks2vVerde}`);
  console.log(`- 1V Vermelho (Falha/Bloqueado): ${checkmarks1vVermelho}`);

  await page.screenshot({ path: path.join(artifactDir, 'live_inbox_andrade_status_verified.png') });
  console.log('Saved screenshot live_inbox_andrade_status_verified.png');

  await browser.close();
  console.log('Live verification completed successfully!');
}

run().catch((err) => {
  console.error('Error during verification:', err);
  process.exit(1);
});
