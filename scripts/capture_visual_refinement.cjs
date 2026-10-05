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

async function runCaptures(suffix = '') {
  console.log(`🚀 Starting capture run ${suffix}...`);
  const token = await getRealAuthToken();

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'],
  });

  // 1. Desktop 1440x900
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
    ignoreHTTPSErrors: true,
  });
  await setupContextAuth(desktopContext, token, 'desktop');
  const desktopPage = await desktopContext.newPage();
  desktopPage.setDefaultTimeout(30000);

  await desktopPage.goto(`${BASE_URL}/ai?tab=agent`, { waitUntil: 'domcontentloaded' });
  await desktopPage.waitForTimeout(4000);

  // 01_desktop_team.png (showing team cards & workspace overview)
  const p1 = path.join(ARTIFACTS_DIR, `01_desktop_team${suffix}.png`);
  await desktopPage.screenshot({ path: p1, fullPage: false });
  console.log(`Saved: ${p1}`);

  // Ensure Camila WORKING
  const workBtn = desktopPage.locator('article button:has-text("WORKING")').first();
  if (await workBtn.isVisible()) {
    await workBtn.click();
    await desktopPage.waitForTimeout(1000);
  }
  // 02_desktop_working.png
  const p2 = path.join(ARTIFACTS_DIR, `02_desktop_working${suffix}.png`);
  await desktopPage.screenshot({ path: p2, fullPage: false });
  console.log(`Saved: ${p2}`);

  // Switch to IDLE
  const idleBtn = desktopPage.locator('article button:has-text("IDLE")').first();
  if (await idleBtn.isVisible()) {
    await idleBtn.click();
    await desktopPage.waitForTimeout(1000);
  }
  // 03_desktop_idle.png
  const p3 = path.join(ARTIFACTS_DIR, `03_desktop_idle${suffix}.png`);
  await desktopPage.screenshot({ path: p3, fullPage: false });
  console.log(`Saved: ${p3}`);

  // Switch to OFFLINE
  const offlineBtn = desktopPage.locator('article button:has-text("OFFLINE")').first();
  if (await offlineBtn.isVisible()) {
    await offlineBtn.click();
    await desktopPage.waitForTimeout(1000);
  }
  // 04_desktop_offline.png
  const p4 = path.join(ARTIFACTS_DIR, `04_desktop_offline${suffix}.png`);
  await desktopPage.screenshot({ path: p4, fullPage: false });
  console.log(`Saved: ${p4}`);

  // Switch to ZAIBOT
  const zaibotTab = desktopPage.locator('button:has-text("ZAIBOT (Mascote 3D)")').first();
  if (await zaibotTab.isVisible()) {
    await zaibotTab.click();
    await desktopPage.waitForTimeout(1500);
  }
  // 05_desktop_zaibot.png
  const p5 = path.join(ARTIFACTS_DIR, `05_desktop_zaibot${suffix}.png`);
  await desktopPage.screenshot({ path: p5, fullPage: false });
  console.log(`Saved: ${p5}`);

  await desktopContext.close();

  // 2. Mobile 390x844
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

  await mobilePage.goto(`${BASE_URL}/ai`, { waitUntil: 'domcontentloaded' });
  await mobilePage.waitForTimeout(4000);

  // 06_mobile_ai.png
  const p6 = path.join(ARTIFACTS_DIR, `06_mobile_ai${suffix}.png`);
  await mobilePage.screenshot({ path: p6, fullPage: false });
  console.log(`Saved: ${p6}`);

  // Open ZAIBOT drawer on mobile
  await mobilePage.evaluate(() => {
    const btn = document.querySelector('button[aria-label*="Assistente ZAI"]');
    if (btn) btn.click();
  });
  await mobilePage.waitForTimeout(1500);
  // 07_mobile_zaibot.png
  const p7 = path.join(ARTIFACTS_DIR, `07_mobile_zaibot${suffix}.png`);
  await mobilePage.screenshot({ path: p7, fullPage: false });
  console.log(`Saved: ${p7}`);

  // Close mobile context
  await mobileContext.close();

  // 3. Mobile Agent Page Context
  const mobileAgentContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: 'dark',
    ignoreHTTPSErrors: true,
  });
  await setupContextAuth(mobileAgentContext, token, 'mobile');
  const agentMobilePage = await mobileAgentContext.newPage();
  agentMobilePage.setDefaultTimeout(30000);

  await agentMobilePage.goto(`${BASE_URL}/ai?tab=agent`, { waitUntil: 'domcontentloaded' });
  await agentMobilePage.waitForTimeout(4000);

  const workspaceArticle = agentMobilePage.locator('article').first();
  if (await workspaceArticle.isVisible()) {
    await workspaceArticle.scrollIntoViewIfNeeded();
    await agentMobilePage.waitForTimeout(1000);
  }

  // 08_mobile_agent.png
  const p8 = path.join(ARTIFACTS_DIR, `08_mobile_agent${suffix}.png`);
  await agentMobilePage.screenshot({ path: p8, fullPage: false });
  console.log(`Saved: ${p8}`);

  await mobileAgentContext.close();
  await browser.close();
  console.log('✅ Capture run complete!');
}

runCaptures(process.argv[2] || '').catch(console.error);
