const { chromium } = require('../../frontend-official/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://209.50.241.22';

const VIEWPORTS = [
  { name: 'desktop-1920x1080', width: 1920, height: 1080 },
  { name: 'desktop-1440x900', width: 1440, height: 900 },
  { name: 'desktop-1280x720', width: 1280, height: 720 },
  { name: 'mobile-390x844', width: 390, height: 844 },
  { name: 'mobile-360x800', width: 360, height: 800 },
  { name: 'landscape-844x390', width: 844, height: 390 },
];

const ROUTES = [
  { path: '/dashboard', name: 'dashboard' },
  { path: '/inbox', name: 'inbox' },
  { path: '/contacts', name: 'contacts' },
  { path: '/campaigns', name: 'campaigns' },
  { path: '/ai', name: 'ai' },
  { path: '/settings', name: 'settings' },
  { path: '/connections', name: 'connections' },
  { path: '/operations', name: 'operations' },
];

const OUTPUT_DIR = path.resolve(__dirname, '../../outros/reports/qa/screenshots/phase4');

(async () => {
  console.log('====================================================');
  console.log('   FASE 4 — VISUAL EVOLUTION SCREENSHOT CAPTURE     ');
  console.log(`   Target: ${BASE_URL}`);
  console.log(`   Output: ${OUTPUT_DIR}`);
  console.log('====================================================\n');

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });

  try {
    const authContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const authPage = await authContext.newPage();
    authPage.setDefaultTimeout(15000);

    console.log('[1/2] Autenticando com credenciais de producao...');
    await authPage.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' });
    await authPage.getByPlaceholder('Digite o usuário').fill('zapadmin');
    await authPage.getByPlaceholder('Digite a senha').fill('zapadmin1010');
    await authPage.getByRole('button', { name: 'Entrar no Dashboard' }).click();
    await authPage.waitForURL('**/dashboard', { timeout: 15000 });
    console.log('✔ Autenticado com sucesso\n');

    const storageState = await authContext.storageState();
    await authContext.close();

    console.log('[2/2] Capturando screenshots nas resoluções e rotas...');
    let totalCaptures = 0;

    for (const vp of VIEWPORTS) {
      console.log(`\n--- Viewport: ${vp.name} (${vp.width}x${vp.height}) ---`);
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        storageState,
      });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);

      for (const route of ROUTES) {
        const url = `${BASE_URL}${route.path}`;
        try {
          await page.goto(url, { waitUntil: 'networkidle', timeout: 12000 }).catch(async () => {
            await page.waitForLoadState('domcontentloaded');
          });
          // Wait briefly for animations / react render stabilization
          await page.waitForTimeout(1000);

          const filename = `${route.name}_${vp.name}.png`;
          const filePath = path.join(OUTPUT_DIR, filename);
          await page.screenshot({ path: filePath, fullPage: false });
          console.log(`  ✔ Capturado: ${filename}`);
          totalCaptures++;
        } catch (err) {
          console.error(`  ✖ Falha ao capturar ${route.name} em ${vp.name}:`, err.message);
        }
      }

      await context.close();
    }

    console.log(`\n====================================================`);
    console.log(`✔ Captura concluída com sucesso: ${totalCaptures} screenshots.`);
    console.log(`Diretório: ${OUTPUT_DIR}`);
    console.log(`====================================================`);
  } catch (error) {
    console.error('Fatal error capturing visuals:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
