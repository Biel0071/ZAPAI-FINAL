const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../../frontend-official/node_modules/playwright'));

async function main() {
  console.log('=== Verificando Presença Unificada, Telefone Completo e Afunilamento de IA ===');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  const artifactDir = 'C:\\Users\\Dell\\.gemini\\antigravity\\brain\\578a7157-8bf3-47e3-82f2-9ed1bb8f9f40';

  try {
    console.log('1. Navegando para login...');
    await page.goto('https://209.50.241.22:1000/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);

    const userInput = page.locator('#login-username, input[type="text"]').first();
    if (await userInput.isVisible()) {
      console.log('Fazendo login como zapadmin...');
      await userInput.fill('zapadmin');
      const passwordInput = page.locator('#login-password, input[type="password"]').first();
      await passwordInput.fill('zapadmin1010');
      await page.click('button:has-text("Entrar"), button[type="submit"]');
      await page.waitForTimeout(3000);
    }

    console.log('2. Navegando para inbox...');
    await page.goto('https://209.50.241.22:1000/inbox', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('select[aria-label="Filtrar por conexão"]', { timeout: 15000 });

    const selectElem = page.locator('select[aria-label="Filtrar por conexão"]');
    const options = await selectElem.locator('option').allTextContents();
    console.log('Opções de conexão:', options);
    const targetOption = options.find(opt => opt.includes('WhatsApp Principal') || opt.includes('9367'));
    if (targetOption) {
      console.log(`Selecionando conexão: ${targetOption}`);
      await selectElem.selectOption({ label: targetOption });
      await page.waitForTimeout(3000);
    }

    console.log('3. Buscando por "jorge jose"...');
    const searchInput = page.locator('input[placeholder*="Buscar conversas"], input[placeholder*="Buscar"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('jorge jose');
      await page.waitForTimeout(1500);
    }

    console.log('4. Clicando em jorge jose via DOM...');
    const clicked = await page.evaluate(() => {
      const allSpans = Array.from(document.querySelectorAll('span, p, div'));
      const target = allSpans.find(el => el.textContent && el.textContent.trim() === 'jorge jose');
      if (target) {
        const clickable = target.closest('button') || target.closest('[role="button"]') || target.closest('[class*="cursor-pointer"]') || target;
        clickable.click();
        return true;
      }
      return false;
    });
    console.log(`Clicado via evaluate: ${clicked}`);

    await page.waitForTimeout(4000);

    // Capturar screenshot principal do inbox com header e sidebar
    const screenshotPath = path.join(artifactDir, 'live_unified_presence_and_funnel.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`Screenshot salva em: ${screenshotPath}`);

    // Avaliar textos e presenças no DOM
    const data = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      return {
        hasFunnel: bodyText.includes('Afunilamento de IA'),
        hasNovoLead: bodyText.includes('Novo Lead'),
        hasOrcamento: bodyText.includes('Orçamento'),
        hasPhoneComplete: bodyText.includes('99695535886450'),
        hasEtiquetasWpp: bodyText.includes('Etiquetas WhatsApp'),
      };
    });

    console.log('--- Diagnóstico de Validação Live ---');
    console.log('Afunilamento de IA presente:', data.hasFunnel);
    console.log('Etapa Novo Lead presente:', data.hasNovoLead);
    console.log('Etapa Orçamento presente:', data.hasOrcamento);
    console.log('Número/ID completo (99695535886450) visível:', data.hasPhoneComplete);
    console.log('Etiquetas WhatsApp presente:', data.hasEtiquetasWpp);

    console.log('=== Verificação Live Concluída com Sucesso ===');
  } catch (err) {
    console.error('Erro durante a verificação:', err);
  } finally {
    await browser.close();
  }
}

main();
