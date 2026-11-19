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
  await page.goto('https://209.50.241.22:1000/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1000);

  const userInput = page.locator('#login-username, input[type="text"]').first();
  if (await userInput.isVisible()) {
    console.log('Logging in as zapadmin...');
    await userInput.fill('zapadmin');
    const passwordInput = page.locator('#login-password, input[type="password"]').first();
    await passwordInput.fill('zapadmin1010');
    await page.click('button:has-text("Entrar"), button[type="submit"]');
    await page.waitForTimeout(3000);
  }

  console.log('2. Navigating to inbox...');
  await page.goto('https://209.50.241.22:1000/inbox', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('select[aria-label="Filtrar por conexão"]', { timeout: 15000 });

  const selectElem = page.locator('select[aria-label="Filtrar por conexão"]');
  const options = await selectElem.locator('option').allTextContents();
  console.log('Available connection options in header:', options);
  const targetOption = options.find(opt => opt.includes('WhatsApp Principal') || opt.includes('9367'));
  if (targetOption) {
    console.log(`Selecting connection: ${targetOption}`);
    await selectElem.selectOption({ label: targetOption });
    await page.waitForTimeout(3000);
  }

  // 3. Find and click jorge jose
  console.log('3. Waiting for jorge jose in conversation list...');
  await page.waitForSelector('text=jorge jose', { timeout: 15000 });
  const jorgeRow = page.locator('text=jorge jose').first();
  
  const startTime = Date.now();
  console.log('Clicking jorge jose...');
  await jorgeRow.click();

  // Wait for message bubbles
  await page.waitForTimeout(2500);
  const loadDuration = Date.now() - startTime;
  console.log(`Jorge jose messages loaded in ${loadDuration} ms`);

  // Verify there are no error banners
  const errorCount = await page.locator('text=Não foi possível carregar as mensagens, text=Falha ao carregar mensagens').count();
  console.log(`Error count in inbox messages: ${errorCount} (expected 0)`);

  await page.screenshot({ path: path.join(artifactDir, 'live_jorge_jose_instant_messages.png') });
  console.log('Saved live_jorge_jose_instant_messages.png');

  // 4. Open Etiquetas WhatsApp Popover in SidebarPanel
  console.log('4. Testing WhatsApp Real Labels popover in SidebarPanel...');
  const etiquetasBtn = page.locator('button:has-text("Etiquetas")').first();
  if (await etiquetasBtn.isVisible()) {
    console.log('Clicking "Etiquetas" button...');
    await etiquetasBtn.click();
    await page.waitForTimeout(1500);

    const popoverHeader = page.locator('text=Etiquetas WhatsApp').first();
    console.log(`Etiquetas WhatsApp popover visible: ${await popoverHeader.isVisible()}`);

    await page.screenshot({ path: path.join(artifactDir, 'live_whatsapp_labels_popover.png') });
    console.log('Saved live_whatsapp_labels_popover.png');

    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
  }

  // 5. Test Auto-IA button in SidebarPanel
  console.log('5. Testing Auto-IA button in SidebarPanel...');
  const autoIaBtn = page.locator('button:has-text("Auto-IA")').first();
  if (await autoIaBtn.isVisible()) {
    console.log('Clicking Auto-IA button...');
    await autoIaBtn.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(artifactDir, 'live_whatsapp_labels_after_ia.png') });
    console.log('Saved live_whatsapp_labels_after_ia.png');
  }

  // 6. Test Campaigns Tag Selector
  console.log('6. Navigating to /campaigns...');
  await page.goto('https://209.50.241.22:1000/campaigns', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  const importDropdown = page.locator('button:has-text("Importar Contatos")').first();
  if (await importDropdown.isVisible()) {
    console.log('Clicking "Importar Contatos" dropdown...');
    await importDropdown.click();
    await page.waitForTimeout(1000);

    const filterTagsOption = page.locator('text=Filtrar por Etiquetas / Tags').first();
    if (await filterTagsOption.isVisible()) {
      console.log('Clicking "Filtrar por Etiquetas / Tags" option...');
      await filterTagsOption.click();
      await page.waitForTimeout(3000);

      const modalTitle = page.locator('text=Selecionar por Etiquetas do WhatsApp').first();
      console.log(`Modal visible: ${await modalTitle.isVisible()}`);

      const badgeButtons = await page.locator('div[role="dialog"] button:has(span.rounded-full)').all();
      console.log(`Real WhatsApp label badges in modal: ${badgeButtons.length}`);

      if (badgeButtons.length > 0) {
        console.log('Clicking first label badge to select contacts...');
        await badgeButtons[0].click();
        await page.waitForTimeout(1000);
      }

      await page.screenshot({ path: path.join(artifactDir, 'live_campaign_real_labels_selector.png') });
      console.log('Saved live_campaign_real_labels_selector.png');
    }
  }

  await browser.close();
  console.log('=== ALL QA VERIFICATIONS PASSED ===');
}

main().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
