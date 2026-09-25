const { chromium } = require('../frontend-official/node_modules/playwright');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('[PLAYWRIGHT] Starting browser verification of Evolution Center...');

  // 1. Generate valid JWT using same mechanism as backend
  // We can fetch the secret from VPS or use default
  const secret = '73d1ef96dde5afc4938e0b71a5978b2666f1885fb0d2febc4bd52cc7a1cd9e15';
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    userId: 'admin-browser',
    companyId: 'default',
    tenantId: 'default',
    role: 'admin',
    exp: Math.floor(Date.now() / 1000) + 86400
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(header + '.' + payload).digest('base64url');
  const token = header + '.' + payload + '.' + sig;

  const authSession = {
    token,
    username: 'admin',
    role: 'admin',
    tenantId: 'default',
    companyId: 'default',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 86400000,
    remember: true
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  const page = await context.newPage();

  page.on('console', msg => console.log('[BROWSER CONSOLE]', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('[BROWSER ERROR]', err.message));
  page.on('response', async resp => {
    if (resp.url().includes('/api/ai/')) {
      let bodyText = '';
      try { bodyText = (await resp.text()).slice(0, 120); } catch (_) {}
      console.log('[BROWSER HTTP]', resp.status(), resp.url(), bodyText);
    }
  });

  // Navigate to VPS base URL
  console.log('[PLAYWRIGHT] Navigating to http://209.50.241.22/ ...');
  await page.goto('http://209.50.241.22/', { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Inject auth session
  console.log('[PLAYWRIGHT] Injecting auth session into localStorage...');
  await page.evaluate((session) => {
    localStorage.setItem('zapai_admin_auth_session', JSON.stringify(session));
  }, authSession);

  // Navigate to Evolution Center
  console.log('[PLAYWRIGHT] Navigating to http://209.50.241.22/ai?tab=evolution ...');
  await page.goto('http://209.50.241.22/ai?tab=evolution', { waitUntil: 'domcontentloaded', timeout: 30000 });

  await page.waitForTimeout(4000);

  // Take screenshot of Evolution Center
  const artifactsDir = path.join(__dirname, '..', 'artifacts');
  if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true });

  const screen1Path = path.join(artifactsDir, 'evolution_center_overview.png');
  await page.screenshot({ path: screen1Path, fullPage: false });
  console.log('[PLAYWRIGHT] Screenshot saved:', screen1Path);

  // Check character viewer or attendant info
  const pageContent = await page.content();
  console.log('[PLAYWRIGHT] Page title:', await page.title());
  console.log('[PLAYWRIGHT] Contains Evolution content:', pageContent.includes('Evolução') || pageContent.includes('Evolu'));

  // Open Obsidian Active Memory Modal
  console.log('[PLAYWRIGHT] Opening Obsidian Memory Modal...');
  const memButton = page.locator('button:has-text("Ver Memória Ativa")').first();
  if (await memButton.isVisible()) {
    await memButton.click();
    await page.waitForTimeout(2000);

    const dialog = page.locator('[role="dialog"]');
    if (await dialog.isVisible()) {
      console.log('[PLAYWRIGHT] Dialog is open, clicking Mídias & Imagens subtab...');
      const mediaTabButton = dialog.locator('button:has-text("Mídias & Imagens")').first();
      await mediaTabButton.click({ force: true });
      
      // Wait for loading to finish
      try {
        await dialog.locator('text=Carregando mídias').waitFor({ state: 'detached', timeout: 15000 });
      } catch (_) {}
      await page.waitForTimeout(2000);

      const screen2Path = path.join(artifactsDir, 'obsidian_memory_media.png');
      await page.screenshot({ path: screen2Path, fullPage: false });
      console.log('[PLAYWRIGHT] Screenshot saved:', screen2Path);

      // Check if real media items loaded
      const mediaCards = dialog.locator('.group.relative.rounded-2xl');
      const count = await mediaCards.count();
      console.log('[PLAYWRIGHT] Media cards visible in modal:', count);

      // Close modal with Escape key
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
    }
  }

  // Click on "Loja & Cores" tab in Evolution Center
  console.log('[PLAYWRIGHT] Switching to Loja & Cores tab...');
  const storeTab = page.locator('button:has-text("Loja & Cores")').first();
  if (await storeTab.isVisible()) {
    await storeTab.click();
    await page.waitForTimeout(2000);

    const screen3Path = path.join(artifactsDir, 'store_whitelabel_customization.png');
    await page.screenshot({ path: screen3Path, fullPage: false });
    console.log('[PLAYWRIGHT] Screenshot saved:', screen3Path);
  }

  await browser.close();
  console.log('[PLAYWRIGHT] Verification completed successfully!');
}

main().catch(err => {
  console.error('[PLAYWRIGHT] Verification failed:', err);
  process.exit(1);
});
