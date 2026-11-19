const path = require('path');
const { chromium } = require(path.resolve(__dirname, '../../frontend-official/node_modules/playwright'));

async function main() {
  console.log('=== Testando Abertura de LeadDrawer com seletor correto ===');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  const artifactDir = 'C:\\Users\\Dell\\.gemini\\antigravity\\brain\\578a7157-8bf3-47e3-82f2-9ed1bb8f9f40';

  await page.goto('https://209.50.241.22:1000/login', { waitUntil: 'networkidle' });
  await page.fill('#login-username', 'zapadmin');
  await page.fill('#login-password', 'zapadmin1010');
  await page.click('button:has-text("Entrar")');
  await page.waitForTimeout(4000);

  await page.goto('https://209.50.241.22:1000/contacts', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Clicar no contact card específico que possui o nome (h4)
  console.log('1. Clicando no card de contato com nome...');
  const contactCard = page.locator('.glass-card:has(h4)').first();
  await contactCard.waitFor({ state: 'visible', timeout: 10000 });
  const contactName = await contactCard.locator('h4').textContent();
  console.log('Nome do contato selecionado:', contactName);
  await contactCard.click();

  console.log('2. Aguardando [role="dialog"]...');
  await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
  await page.waitForTimeout(2000);

  const screenshotPath = path.join(artifactDir, 'live_contact_drawer_funnel_and_tags_success.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`[OK] Screenshot salva: ${screenshotPath}`);

  const checks = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]') || document.body;
    const text = dialog.innerText || '';
    return {
      dialogVisible: Boolean(document.querySelector('[role="dialog"]')),
      hasAfunilamento: text.includes('Afunilamento de IA') || text.includes('AFUNILAMENTO DE IA'),
      hasTempButtons: text.includes('Quente') && text.includes('Morno') && text.includes('Frio'),
      hasFunnelStages: text.includes('Novo Lead') && text.includes('Orçamento') && text.includes('Fechado'),
      hasAnaliseAlgoritmica: text.includes('Análise Algorítmica da Conversa') || text.includes('Análise Algorítmica'),
      hasWppLabels: text.includes('Etiquetas WhatsApp') || text.includes('Etiquetas Reais'),
      textSnippet: text.slice(0, 400).replace(/\n/g, ' | '),
    };
  });

  console.log('--- Verificações do LeadDrawer Aberto ---');
  console.log(checks);

  await browser.close();
}

main().catch(console.error);
