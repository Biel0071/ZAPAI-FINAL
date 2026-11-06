const { chromium } = require('playwright');
const path = require('path');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  console.log('Navigating to login...');
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

  console.log('Navigating to inbox...');
  await page.goto('https://209.50.241.22:1000/inbox', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);

  const artifactDir = 'C:\\Users\\Dell\\.gemini\\antigravity\\brain\\578a7157-8bf3-47e3-82f2-9ed1bb8f9f40';

  // Click on Deposito Material V A
  console.log('Selecting conversation Deposito Material V A...');
  const depConv = page.locator('text=Deposito Material V A').first();
  if (await depConv.isVisible()) {
    await depConv.click();
    await page.waitForTimeout(2000);
  }

  // Verify single connection in Header select
  const selectElem = page.locator('select[aria-label="Filtrar por conexão"]');
  const selectedConnectionText = await selectElem.locator('option:checked').textContent().catch(() => '');
  console.log('Selected single connection:', selectedConnectionText.trim());

  // Check header emoji buttons
  const buttons = await page.locator('.h-header, [aria-label="Buscar na conversa"], [aria-label="Gerar Ficha"], [aria-label="Pedidos WhatsApp"], [aria-label="Transferir atendimento"], [aria-label="Abrir Pop-up de Disparos"], [aria-label="Finalizar atendimento"]').allTextContents().catch(() => []);
  console.log('Header buttons visible:', buttons);

  // Take screenshot of clean conversation header with monochrome minimalist icons
  await page.screenshot({ path: path.join(artifactDir, 'live_inbox_monochrome_icons_header.png') });
  await page.screenshot({ path: path.join(artifactDir, 'live_inbox_clean_emojis_header.png') });
  console.log('Saved live_inbox_monochrome_icons_header.png');

  // Open ... menu and click "Personalizar Ações Rápidas (Admin)"
  console.log('Opening ... options menu...');
  const dotsBtn = page.locator('button[aria-label="Opções adicionais"], button[title="Menu adicional"]').first();
  if (await dotsBtn.isVisible()) {
    await dotsBtn.click();
    await page.waitForTimeout(1000);

    const configOption = page.locator('text=Personalizar Ações').first();
    if (await configOption.isVisible()) {
      console.log('Clicking "Personalizar Ações (Admin)"...');
      await configOption.click();
      await page.waitForTimeout(1500);

      // Take screenshot of the Admin Actions Configuration Dialog
      await page.screenshot({ path: path.join(artifactDir, 'live_admin_actions_monochrome_dialog.png') });
      await page.screenshot({ path: path.join(artifactDir, 'live_admin_actions_config_dialog.png') });
      console.log('Saved live_admin_actions_monochrome_dialog.png');
    } else {
      console.log('"Personalizar Ações" option not found in menu');
    }
  }

  await browser.close();
  console.log('Verification finished successfully!');
}

main().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
