const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../../frontend-official/node_modules/playwright'));

async function main() {
  console.log('=== Verificando Separação: Etiquetas Reais no Sidebar vs Afunilamento e Análise em Contatos ===');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  const artifactDir = 'C:\\Users\\Dell\\.gemini\\antigravity\\brain\\578a7157-8bf3-47e3-82f2-9ed1bb8f9f40';

  try {
    console.log('1. Autenticando na VPS...');
    await page.goto('https://209.50.241.22:1000/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);

    const userInput = page.locator('#login-username, input[type="text"]').first();
    if (await userInput.isVisible()) {
      await userInput.fill('zapadmin');
      const passwordInput = page.locator('#login-password, input[type="password"]').first();
      await passwordInput.fill('zapadmin1010');
      await page.click('button:has-text("Entrar"), button[type="submit"]');
      await page.waitForTimeout(3000);
    }

    console.log('2. Acessando Inbox...');
    await page.goto('https://209.50.241.22:1000/inbox', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('select[aria-label="Filtrar por conexão"]', { timeout: 15000 });

    const selectElem = page.locator('select[aria-label="Filtrar por conexão"]');
    const options = await selectElem.locator('option').allTextContents();
    const targetOption = options.find(opt => opt.includes('WhatsApp Principal') || opt.includes('9367'));
    if (targetOption) {
      await selectElem.selectOption({ label: targetOption });
      await page.waitForTimeout(2500);
    }

    // Screenshot 1: Inbox com sidebar direito limpo (apenas etiquetas reais do WhatsApp)
    const inboxScreenshot = path.join(artifactDir, 'live_inbox_clean_sidebar_real_labels.png');
    await page.screenshot({ path: inboxScreenshot, fullPage: true });
    console.log(`[OK] Screenshot Inbox salva: ${inboxScreenshot}`);

    // Avaliar DOM do SidebarPanel
    const sidebarChecks = await page.evaluate(() => {
      const rightSidebar = document.querySelector('aside, [class*="w-72"], [class*="w-80"], [class*="border-l"]') || document.body;
      const sidebarText = rightSidebar.innerText || '';
      
      return {
        hasRealLabelsSection: sidebarText.includes('Etiquetas') || sidebarText.includes('Etiquetas WhatsApp'),
        hasVerContatosButton: sidebarText.includes('Ver Contatos') || sidebarText.includes('Ficha 360'),
        hasAlgorithmicTagsInSidebar: sidebarText.includes('price_request') || sidebarText.includes('send_price') || sidebarText.includes('handover_human'),
        hasAfunilamentoInSidebar: sidebarText.includes('Afunilamento de IA'),
        hasOrigem: sidebarText.includes('Origem'),
      };
    });

    console.log('--- Diagnóstico Sidebar Direito do Inbox ---');
    console.log('Etiquetas reais presentes no sidebar:', sidebarChecks.hasRealLabelsSection);
    console.log('Botão Ficha 360 / Ver Contatos presente:', sidebarChecks.hasVerContatosButton);
    console.log('Tags algorítmicas no sidebar (deve ser false):', sidebarChecks.hasAlgorithmicTagsInSidebar);
    console.log('Afunilamento de IA no sidebar (deve ser false):', sidebarChecks.hasAfunilamentoInSidebar);
    console.log('Origem presente:', sidebarChecks.hasOrigem);

    console.log('3. Abrindo Ficha 360 no Inbox via botão "Ver Contatos →"...');
    const fichaBtn = page.locator('button:has-text("Ver Contatos")').first();
    if (await fichaBtn.isVisible()) {
      await fichaBtn.click();
    } else {
      await page.evaluate(() => window.dispatchEvent(new CustomEvent('zapflow:open-lead-modal')));
    }

    await page.waitForSelector('[role="dialog"]', { timeout: 8000 }).catch(() => console.log('Dialog timeout no inbox'));
    await page.waitForTimeout(2000);

    const inboxDrawerScreenshot = path.join(artifactDir, 'live_lead_drawer_from_inbox.png');
    await page.screenshot({ path: inboxDrawerScreenshot, fullPage: true });
    console.log(`[OK] Screenshot LeadDrawer no Inbox salva: ${inboxDrawerScreenshot}`);

    console.log('4. Navegando para página de Contatos (/contatos)...');
    await page.goto('https://209.50.241.22:1000/contatos', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Clicar no primeiro contato da tabela de contatos
    console.log('5. Clicando no primeiro contato da lista em /contatos...');
    const contactRow = page.locator('tbody tr, [role="row"], table tr').nth(1);
    if (await contactRow.isVisible()) {
      await contactRow.click();
      await page.waitForSelector('[role="dialog"]', { timeout: 8000 }).catch(() => null);
      await page.waitForTimeout(2500);
    } else {
      // Fallback: tentar clicar pelo texto do nome
      await page.evaluate(() => {
        const rows = document.querySelectorAll('tr, [class*="cursor-pointer"]');
        if (rows.length > 2 && rows[2].click) rows[2].click();
      });
      await page.waitForTimeout(2500);
    }

    const contactsDrawerScreenshot = path.join(artifactDir, 'live_lead_drawer_from_contacts.png');
    await page.screenshot({ path: contactsDrawerScreenshot, fullPage: true });
    console.log(`[OK] Screenshot LeadDrawer em Contatos salva: ${contactsDrawerScreenshot}`);

    // Avaliar DOM do LeadDrawer
    const drawerChecks = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]') || document.body;
      const text = dialog.innerText || '';
      return {
        hasAfunilamentoIA: text.includes('Afunilamento de IA') || text.includes('AFUNILAMENTO DE IA'),
        hasTempQuente: text.includes('Quente') || text.includes('🔥 Quente'),
        hasTempMorno: text.includes('Morno') || text.includes('🌤️ Morno'),
        hasTempFrio: text.includes('Frio') || text.includes('❄️ Frio'),
        hasNovoLeadStage: text.includes('Novo Lead') || text.includes('🌱 Novo Lead'),
        hasOrcamentoStage: text.includes('Orçamento') || text.includes('📑 Orçamento'),
        hasAnaliseAlgoritmica: text.includes('Análise Algorítmica da Conversa') || text.includes('Análise Algorítmica'),
        hasRealWhatsAppLabels: text.includes('Etiquetas WhatsApp') || text.includes('Etiquetas Reais WhatsApp'),
      };
    });

    console.log('--- Diagnóstico LeadDrawer (Ficha do Contato) ---');
    console.log('Afunilamento de IA presente na ficha:', drawerChecks.hasAfunilamentoIA);
    console.log('Seletor de Temperatura presente:', drawerChecks.hasTempQuente && drawerChecks.hasTempFrio);
    console.log('Etapas do Funil presentes:', drawerChecks.hasNovoLeadStage && drawerChecks.hasOrcamentoStage);
    console.log('Análise Algorítmica da Conversa presente:', drawerChecks.hasAnaliseAlgoritmica);
    console.log('Etiquetas WhatsApp presentes:', drawerChecks.hasRealWhatsAppLabels);

    console.log('=== Verificação Concluída com Sucesso ===');
  } catch (err) {
    console.error('Erro na execução do teste:', err);
  } finally {
    await browser.close();
  }
}

main();
