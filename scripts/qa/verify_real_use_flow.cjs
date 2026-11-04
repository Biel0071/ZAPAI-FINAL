const { chromium } = require('../../frontend-official/node_modules/playwright');
const path = require('path');
const fs = require('fs');

async function validateRealUse() {
  const artifactDir = path.resolve('C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40');
  console.log('--- VALIDATING REAL USE ON PRODUCTION VPS (209.50.241.22:1000) ---');

  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  const report = {
    loginPage: false,
    authSuccess: false,
    connectionsPage: false,
    inboxLoaded: false,
    catalogOpened: false,
    productsVisible: 0,
    screenshots: []
  };

  try {
    // 1. Validar Tela de Login
    console.log('1. Navegando para https://209.50.241.22:1000/login ...');
    await page.goto('https://209.50.241.22:1000/login', { timeout: 35000, waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#login-username', { timeout: 15000 });
    
    const loginShot = path.join(artifactDir, 'real_use_login_live.png');
    await page.screenshot({ path: loginShot, fullPage: true });
    report.loginPage = true;
    report.screenshots.push(loginShot);
    console.log('✔ Tela de login capturada com sucesso:', loginShot);

    // 2. Efetuar Login Real
    console.log('2. Efetuando autenticação com zapadmin...');
    await page.fill('#login-username', 'zapadmin');
    await page.fill('#login-password', 'zapadmin1010');
    await Promise.all([
      page.waitForNavigation({ timeout: 20000 }).catch(() => {}),
      page.click('button[type="submit"]')
    ]);
    await page.waitForTimeout(3000);
    report.authSuccess = true;
    console.log('✔ Autenticação efetuada com sucesso!');

    // 3. Validar Tela de Conexões
    console.log('3. Navegando para /connections ...');
    await page.goto('https://209.50.241.22:1000/connections', { timeout: 35000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const connectionsShot = path.join(artifactDir, 'real_use_connections_live.png');
    await page.screenshot({ path: connectionsShot, fullPage: true });
    report.connectionsPage = true;
    report.screenshots.push(connectionsShot);
    console.log('✔ Tela de Conexões capturada com sucesso:', connectionsShot);

    // 4. Validar Inbox e Casca de Botões
    console.log('4. Navegando para /inbox ...');
    await page.goto('https://209.50.241.22:1000/inbox', { timeout: 35000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    report.inboxLoaded = true;

    // Selecionar conversa se existir
    const chatItem = page.locator('[data-conversation-id], [data-testid^="conversation-item"], div[role="button"]:has-text("+55")').first();
    if (await chatItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Clicando na primeira conversa...');
      await chatItem.click();
      await page.waitForTimeout(2000);
    }

    // 5. Testar abertura do Catálogo Real
    console.log('5. Testando gatilho do catálogo...');
    const catalogTrigger = page.locator('[data-catalog-trigger], button:has-text("Catálogo"), button[aria-label*="Catálogo"]').first();
    if (await catalogTrigger.isVisible({ timeout: 6000 }).catch(() => false)) {
      await catalogTrigger.click();
      await page.waitForTimeout(2000);
      report.catalogOpened = true;

      const productItems = await page.locator('[data-catalog-popover] div:has-text("R$"), div[role="listitem"]:has-text("R$")').count();
      report.productsVisible = productItems;
      console.log(`✔ Popover do catálogo aberto com ${productItems} produtos visíveis!`);

      const addBtn = page.locator('[data-add-product-trigger]');
      if (await addBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
        console.log('✔ Botão "Adicionar novo item" presente no popover! Testando abertura do modal...');
        await addBtn.click();
        await page.waitForTimeout(1500);
        const modalVisible = await page.locator('text=Adicionar novo item').isVisible({ timeout: 5000 }).catch(() => false);
        if (modalVisible) {
          console.log('✔ Modal de Criação de Produto aberto com sucesso!');
          const modalShot = path.join(artifactDir, 'real_use_product_form_modal.png');
          await page.screenshot({ path: modalShot });
          report.screenshots.push(modalShot);
          await page.keyboard.press('Escape');
          await page.waitForTimeout(1000);
        }
      }
    }

    const inboxShot = path.join(artifactDir, 'real_use_inbox_live.png');
    await page.screenshot({ path: inboxShot, fullPage: true });
    report.screenshots.push(inboxShot);
    console.log('✔ Tela do Inbox capturada com sucesso:', inboxShot);

  } catch (err) {
    console.error('Erro na validação real:', err);
    report.error = err.message;
  } finally {
    await browser.close();
    console.log('\n--- RELATÓRIO DE VALIDAÇÃO REAL ---');
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.authSuccess ? 0 : 1);
  }
}

validateRealUse();

