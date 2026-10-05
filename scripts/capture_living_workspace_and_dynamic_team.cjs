const fs = require('fs');
const path = require('path');
const { chromium } = require('../frontend-official/node_modules/@playwright/test/index.js');

const BASE_URL = 'http://127.0.0.1:8080';
const BACKEND_URL = 'http://127.0.0.1:4025';
const ARTIFACTS_DIR = 'C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40';

async function getRealAuthToken() {
  const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': 'default' },
    body: JSON.stringify({ username: 'zapadmin', password: 'zapadmin123', tenantId: 'default' }),
  });
  const data = await res.json();
  if (!data.token) {
    throw new Error('Falha ao obter token da API: ' + JSON.stringify(data));
  }
  return data.token;
}

async function setupContextAuth(context, token, viewMode = 'desktop') {
  const session = {
    token,
    username: 'zapadmin',
    role: 'master',
    tenantId: 'default',
    companyId: 'default',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 86400000,
    remember: true,
  };
  await context.addInitScript(({ session, token, viewMode }) => {
    localStorage.setItem('auth-storage', JSON.stringify({
      state: { token, user: { id: 1, role: 'master_admin', username: 'zapadmin' }, isAuthenticated: true, companyId: 'default' },
      version: 0,
    }));
    localStorage.setItem('zapai_admin_auth_session', JSON.stringify(session));
    localStorage.setItem('token', token);
    localStorage.setItem('auth_token', token);
    localStorage.setItem('company_id', 'default');
    localStorage.setItem('tenant_id', 'default');
    localStorage.setItem('zapflow_view_mode', viewMode);
  }, { session, token, viewMode });
}

async function main() {
  console.log('🚀 Starting screenshot capture of Living Workspace & Dynamic Team on local runtime...');
  const token = await getRealAuthToken();
  console.log('🔑 Real authenticated token obtained from backend successfully.');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'],
  });

  // 1. Desktop 1440x900 Context
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
    ignoreHTTPSErrors: true,
  });
  await setupContextAuth(desktopContext, token, 'desktop');

  const desktopPage = await desktopContext.newPage();
  desktopPage.setDefaultTimeout(30000);
  desktopPage.setDefaultNavigationTimeout(45000);

  console.log('📸 1. Navigating to AI & Automação page (/ai?tab=agent)...');
  await desktopPage.goto(`${BASE_URL}/ai?tab=agent`, { waitUntil: 'domcontentloaded' });
  await desktopPage.waitForTimeout(5000);

  // Ensure Camila is selected and working
  console.log('📸 Ensuring Camila WORKING state (no computador trabalhando)...');
  const workingBtn = desktopPage.locator('article button:has-text("WORKING")').first();
  if (await workingBtn.isVisible()) {
    await workingBtn.click();
    await desktopPage.waitForTimeout(1500);
  }

  // Screenshot 1: Camila Living Workspace WORKING
  const ss1Path = path.join(ARTIFACTS_DIR, 'screenshot_ai_living_workspace_working.png');
  await desktopPage.screenshot({ path: ss1Path, fullPage: false });
  console.log(`✅ Saved: ${ss1Path}`);

  // Screenshot 2: Click OFFLINE toggle button in the Character Workspace
  console.log('📸 2. Switching Camila to OFFLINE state (em pé esperando sem fazer nada)...');
  const offlineBtn = desktopPage.locator('article button:has-text("OFFLINE")').first();
  if (await offlineBtn.isVisible()) {
    await offlineBtn.click();
    await desktopPage.waitForTimeout(2000);
  }
  const ss2Path = path.join(ARTIFACTS_DIR, 'screenshot_ai_living_workspace_offline.png');
  await desktopPage.screenshot({ path: ss2Path, fullPage: false });
  console.log(`✅ Saved: ${ss2Path}`);

  // Screenshot 3: Click Rafael in DigitalTeamView
  console.log('📸 3. Selecting Rafael (Suporte Técnico & SAC) from Digital Team...');
  const rafaelCard = desktopPage.locator('div[role="button"]:has-text("Rafael")').first();
  if (await rafaelCard.isVisible()) {
    await rafaelCard.click();
    await desktopPage.waitForTimeout(2000);
    // Switch to working to see his support desk
    const rafaelWorkBtn = desktopPage.locator('article button:has-text("WORKING")').first();
    if (await rafaelWorkBtn.isVisible()) {
      await rafaelWorkBtn.click();
      await desktopPage.waitForTimeout(1500);
    }
  }
  const ssRafaelPath = path.join(ARTIFACTS_DIR, 'screenshot_rafael_suporte_workspace.png');
  await desktopPage.screenshot({ path: ssRafaelPath, fullPage: false });
  console.log(`✅ Saved: ${ssRafaelPath}`);

  // Screenshot 4: Click Julia in DigitalTeamView
  console.log('📸 4. Selecting Julia (Pós-Venda & Fidelização) from Digital Team...');
  const juliaCard = desktopPage.locator('div[role="button"]:has-text("Julia")').first();
  if (await juliaCard.isVisible()) {
    await juliaCard.click();
    await desktopPage.waitForTimeout(2000);
    // Switch to working to see her CS workspace
    const juliaWorkBtn = desktopPage.locator('article button:has-text("WORKING")').first();
    if (await juliaWorkBtn.isVisible()) {
      await juliaWorkBtn.click();
      await desktopPage.waitForTimeout(1500);
    }
  }
  const ssJuliaPath = path.join(ARTIFACTS_DIR, 'screenshot_julia_pos_venda_workspace.png');
  await desktopPage.screenshot({ path: ssJuliaPath, fullPage: false });
  console.log(`✅ Saved: ${ssJuliaPath}`);

  // Screenshot 5: Switch to ZAIBOT (Mascote 3D)
  console.log('📸 5. Switching to ZAIBOT Mascote 3D mode in workspace...');
  const zaibotTabBtn = desktopPage.locator('button:has-text("ZAIBOT (Mascote 3D)")').first();
  if (await zaibotTabBtn.isVisible()) {
    await zaibotTabBtn.click();
    await desktopPage.waitForTimeout(1500);
  }
  const ss3Path = path.join(ARTIFACTS_DIR, 'screenshot_zaibot_mascot_3d_lab.png');
  await desktopPage.screenshot({ path: ss3Path, fullPage: false });
  console.log(`✅ Saved: ${ss3Path}`);

  await desktopContext.close();

  // 2. Mobile 390x844 (iPhone 14 / modern smartphone viewport)
  console.log('📱 6. Launching Mobile Context (390x844) to verify Ergonomic ZAIBOT Positioning...');
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: 'dark',
    ignoreHTTPSErrors: true,
  });
  await setupContextAuth(mobileContext, token, 'mobile');

  const mobilePage = await mobileContext.newPage();
  mobilePage.setDefaultTimeout(30000);
  mobilePage.setDefaultNavigationTimeout(45000);

  await mobilePage.goto(`${BASE_URL}/ai?tab=agent`, { waitUntil: 'domcontentloaded' });
  await mobilePage.waitForTimeout(4000);

  // Screenshot 6: Mobile AI Hub showing ZAIBOT floating button at bottom-20 (clearing MobileBottomNav)
  const ss4Path = path.join(ARTIFACTS_DIR, 'screenshot_mobile_ai_hub_ergonomic.png');
  await mobilePage.screenshot({ path: ss4Path, fullPage: false });
  console.log(`✅ Saved: ${ss4Path}`);

  // Screenshot 7: Open ZAIBOT Assistant on mobile
  console.log('📱 7. Clicking ZAIBOT floating assistant on mobile...');
  await mobilePage.evaluate(() => {
    const btn = document.querySelector('button[aria-label*="Assistente ZAI"]');
    if (btn) btn.click();
  });
  await mobilePage.waitForTimeout(2000);

  const ss5Path = path.join(ARTIFACTS_DIR, 'screenshot_mobile_zaibot_copilot_drawer.png');
  await mobilePage.screenshot({ path: ss5Path, fullPage: false });
  console.log(`✅ Saved: ${ss5Path}`);

  await mobileContext.close();
  await browser.close();
  console.log('🎉 All screenshots successfully captured with real authentic data!');
}

main().catch((err) => {
  console.error('❌ Error capturing screenshots:', err);
  process.exit(1);
});
