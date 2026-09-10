const { chromium } = require('../../frontend-official/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://209.50.241.22';

const VIEWPORTS = [
  { name: 'Mobile 360x800', width: 360, height: 800 },
  { name: 'Mobile iPhone 390x844', width: 390, height: 844 },
  { name: 'Mobile Android 412x915', width: 412, height: 915 },
  { name: 'Tablet 768x1024', width: 768, height: 1024 },
  { name: 'Tablet 844x1180', width: 844, height: 1180 },
  { name: 'Landscape 844x390', width: 844, height: 390 },
  { name: 'Landscape 915x412', width: 915, height: 412 },
  { name: 'HD Laptop 1280x720', width: 1280, height: 720 },
  { name: 'MacBook 1440x900', width: 1440, height: 900 },
  { name: 'FHD Desktop 1920x1080', width: 1920, height: 1080 },
  { name: 'Ultrawide 2560x1080', width: 2560, height: 1080 },
];

const CORE_ROUTES = [
  { route: '/settings', id: 'P3-01-Settings' },
  { route: '/contacts', id: 'P3-02-Contacts' },
  { route: '/campaigns', id: 'P3-03-Campaigns' },
  { route: '/ai', id: 'P3-04-AI' },
  { route: '/inbox', id: 'Inbox-Ops' },
  { route: '/dashboard', id: 'Dashboard' },
  { route: '/connections', id: 'Connections' },
  { route: '/operations', id: 'Operations' },
  { route: '/memory', id: 'Memory' },
  { route: '/flows', id: 'Flows' },
];

(async () => {
  console.log('====================================================');
  console.log('   FASE 3 — REAL PRODUCTION VISUAL QA VERIFICATION  ');
  console.log(`   Target: ${BASE_URL}`);
  console.log('====================================================\n');

  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    // 1. Authenticate
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);

    console.log('[1/5] Autenticando no Zapflow CRM em producao...');
    await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder('Digite o usuário').fill('zapadmin');
    await page.getByPlaceholder('Digite a senha').fill('zapadmin1010');
    await page.getByRole('button', { name: 'Entrar no Dashboard' }).click();
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    console.log('✔ Autenticado com sucesso na rota /dashboard\n');

    // Save storage state for reuse
    const storageState = await context.storageState();
    await context.close();

    // 2. Test each viewport for horizontal overflow & layout integrity across ALL 10 core screens
    console.log('[2/5] Testando responsividade e overflow horizontal em 11 viewports e 10 rotas...');

    for (const vp of VIEWPORTS) {
      const vpContext = await browser.newContext({
        storageState,
        viewport: { width: vp.width, height: vp.height },
      });
      const vpPage = await vpContext.newPage();
      vpPage.setDefaultTimeout(15000);

      for (const t of CORE_ROUTES) {
        try {
          await vpPage.goto(BASE_URL + t.route, { waitUntil: 'domcontentloaded' });
          await vpPage.waitForTimeout(1200);

          const overflowInfo = await vpPage.evaluate(() => {
            const docWidth = document.documentElement.clientWidth;
            const scrollWidth = document.documentElement.scrollWidth;
            const bodyScrollWidth = document.body ? document.body.scrollWidth : 0;
            const maxScroll = Math.max(scrollWidth, bodyScrollWidth);
            const hasHorizontalScroll = maxScroll > docWidth + 2; // allowance of 2px
            return {
              clientWidth: docWidth,
              scrollWidth: maxScroll,
              overflow: hasHorizontalScroll,
              diff: maxScroll - docWidth,
            };
          });

          const isPass = !overflowInfo.overflow;
          results.push({
            viewport: vp.name,
            size: `${vp.width}x${vp.height}`,
            route: t.route,
            screen: t.id,
            clientWidth: overflowInfo.clientWidth,
            scrollWidth: overflowInfo.scrollWidth,
            overflowDiff: overflowInfo.diff,
            status: isPass ? 'PASS' : 'FAIL',
          });

          console.log(`  [${isPass ? 'PASS' : 'FAIL'}] ${vp.name} (${vp.width}x${vp.height}) -> ${t.route} (scrollWidth: ${overflowInfo.scrollWidth}, clientWidth: ${overflowInfo.clientWidth})`);
        } catch (err) {
          console.log(`  [ERROR] ${vp.name} -> ${t.route}: ${err.message}`);
          results.push({
            viewport: vp.name,
            size: `${vp.width}x${vp.height}`,
            route: t.route,
            screen: t.id,
            status: 'ERROR',
            error: err.message,
          });
        }
      }

      await vpContext.close();
    }

    // 3. Specific validation for P3-01 to P3-04
    console.log('\n[3/5] Validando especificamente P3-01 a P3-04...');
    const mobileContext = await browser.newContext({
      storageState,
      viewport: { width: 360, height: 800 },
    });
    const mobilePage = await mobileContext.newPage();

    // P3-01: Settings select dropdown
    await mobilePage.goto(BASE_URL + '/settings', { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForSelector('select', { timeout: 10000 });
    const settingsSelectCount = await mobilePage.locator('select').count();
    console.log(`  P3-01 Settings Mobile: Encontrados ${settingsSelectCount} elemento(s) <select> para navegacao responsiva de abas.`);

    // P3-02: Contacts filter controls
    await mobilePage.goto(BASE_URL + '/contacts', { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForSelector('button:has-text("Filtrar")', { timeout: 10000 });
    const contactsSearchVisible = await mobilePage.locator('input[placeholder*="Buscar contatos"]').isVisible();
    const contactsDrawerTrigger = await mobilePage.locator('button:has-text("Filtrar")').count();
    console.log(`  P3-02 Contacts Mobile: Campo de busca visivel=${contactsSearchVisible}, Botao Filtrar drawer count=${contactsDrawerTrigger}.`);

    // P3-03: Campaigns sticky action bar in landscape
    await mobilePage.setViewportSize({ width: 844, height: 390 });
    await mobilePage.goto(BASE_URL + '/campaigns', { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForSelector('h2:has-text("Nova Campanha")', { timeout: 10000 });
    const campaignsHeadingVisible = await mobilePage.locator('h2:has-text("Nova Campanha")').isVisible();
    const campaignsActionVisible = await mobilePage.locator('button:has-text("Salvar Rascunho")').isVisible();
    console.log(`  P3-03 Campaigns Landscape (844x390): Heading Nova Campanha visivel=${campaignsHeadingVisible}, Botao Salvar Rascunho=${campaignsActionVisible}.`);

    // P3-04: AI Sandbox on 360px
    await mobilePage.setViewportSize({ width: 360, height: 800 });
    await mobilePage.goto(BASE_URL + '/ai', { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForSelector('button:has-text("Testar IA")', { timeout: 10000 });
    const testIaBtn = await mobilePage.locator('button:has-text("Testar IA")').count();
    console.log(`  P3-04 AI Sandbox Mobile: Botao "Testar IA" count=${testIaBtn}.`);

    await mobileContext.close();

    // 4. Validating route redirects and navigation links
    console.log('\n[4/5] Validando redirecionamentos de rotas e integridade dos links...');
    const desktopContext = await browser.newContext({
      storageState,
      viewport: { width: 1440, height: 900 },
    });
    const desktopPage = await desktopContext.newPage();

    // Redirect tests
    const redirectChecks = [
      { from: '/queue', expectedUrlMatch: /tab=queue/ },
      { from: '/diagnostics', expectedUrlMatch: /tab=diagnostics/ },
      { from: '/users', expectedUrlMatch: /tab=users/ },
      { from: '/nodes', expectedUrlMatch: /tab=nodes/ },
    ];

    for (const r of redirectChecks) {
      try {
        await desktopPage.goto(BASE_URL + r.from, { waitUntil: 'domcontentloaded' });
        await desktopPage.waitForURL(r.expectedUrlMatch, { timeout: 10000 });
        const curUrl = desktopPage.url();
        console.log(`  Redirect ${r.from} -> ${curUrl}: PASS`);
      } catch (err) {
        console.log(`  Redirect ${r.from} -> ${desktopPage.url()}: FAIL (${err.message})`);
      }
    }

    await desktopContext.close();

    // 5. Summarize results
    console.log('\n[5/5] RESUMO GERAL DE RESPONSIVIDADE E QUALIDADE:');
    const totalTests = results.length;
    const passedTests = results.filter(r => r.status === 'PASS').length;
    const failedTests = results.filter(r => r.status === 'FAIL').length;
    console.log(`Total de testes de tela x viewport: ${totalTests}`);
    console.log(`Aprovados (sem overflow horizontal): ${passedTests}`);
    console.log(`Falhas: ${failedTests}`);

    // Save report to disk
    const reportPath = path.resolve(__dirname, '../../outros/reports/qa/phase3-visual-qa-results.json');
    fs.writeFileSync(reportPath, JSON.stringify({ results, summary: { total: totalTests, passed: passedTests, failed: failedTests } }, null, 2));
    console.log(`\nRelatorio salvo em: ${reportPath}`);

  } catch (err) {
    console.error('Falha geral no teste:', err);
  } finally {
    await browser.close();
  }
})();
