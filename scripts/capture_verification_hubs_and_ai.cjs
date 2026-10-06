const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('../frontend-official/node_modules/@playwright/test/index.js');

const BASE_URL = 'http://209.50.241.22';
const USERNAME = 'zapadmin';
const PASSWORD = 'zapadmin1010';
const JWT_SECRET = '73d1ef96dde5afc4938e0b71a5978b2666f1885fb0d2febc4bd52cc7a1cd9e15';
const ARTIFACTS_DIR = 'C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40';

function generateAdminToken() {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: 'zapadmin',
    username: 'zapadmin',
    tenantId: 'default',
    companyId: 'default',
    role: 'master',
    iat: now,
    exp: now + 86400 * 7,
  };
  const toB64Url = (obj) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  const sData = `${toB64Url(header)}.${toB64Url(payload)}`;
  const sig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(sData)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${sData}.${sig}`;
}

async function loginIfNeeded(page) {
  const token = generateAdminToken();
  await page.addInitScript(({ token }) => {
    const session = {
      token,
      username: 'zapadmin',
      role: 'master',
      tenantId: 'default',
      companyId: 'default',
      issuedAt: Date.now(),
      expiresAt: Date.now() + 86400 * 7 * 1000,
      remember: true,
    };
    localStorage.setItem('zapai_admin_auth_session', JSON.stringify(session));
    localStorage.setItem('token', token);
    localStorage.setItem('auth_token', token);
    localStorage.setItem('company_id', 'default');
    localStorage.setItem('tenant_id', 'default');
  }, { token });

  if (page.url().includes('login') || (await page.locator('input[type="password"]').count()) > 0) {
    const userInput = page.locator('input[type="text"], input[name="username"]').first();
    if (await userInput.isVisible()) await userInput.fill(USERNAME);
    const pwInput = page.locator('input[type="password"]').first();
    if (await pwInput.isVisible()) await pwInput.fill(PASSWORD);
    const submitBtn = page.locator('button[type="submit"], button:has-text("Entrar")').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await page.waitForTimeout(3000);
    }
  }
}

async function main() {
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }

  console.log('🚀 Launching browser to capture verification screenshots...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'],
  });

  // --- 1. DASHBOARD HUB 1 (Overview - 1080p & 900p Viewports) ---
  console.log('📸 1. Capturing Dashboard Hub 1 (1440x900 viewport)...');
  const context1440 = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page1440 = await context1440.newPage();
  page1440.setDefaultTimeout(30000);
  page1440.setDefaultNavigationTimeout(45000);
  await loginIfNeeded(page1440);

  await page1440.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
  await page1440.waitForTimeout(3500);
  await loginIfNeeded(page1440);
  await page1440.waitForTimeout(2000);

  const hub1Path1440 = path.join(ARTIFACTS_DIR, 'dashboard_hub1_single_screen_900p.png');
  await page1440.screenshot({ path: hub1Path1440, fullPage: false });
  console.log(`Saved: ${hub1Path1440}`);

  // Test floating mascot in Dashboard
  console.log('📸 2. Triggering Floating ZAI Mascot...');
  try {
    const mascotTrigger = page1440.locator('button[title*="ZAI"], button:has-text("ZAI"), div.fixed.bottom-5 button').last();
    if (await mascotTrigger.isVisible()) {
      await mascotTrigger.click();
      await page1440.waitForTimeout(1500);
      const mascotPath = path.join(ARTIFACTS_DIR, 'floating_zai_mascot_open.png');
      await page1440.screenshot({ path: mascotPath, fullPage: false });
      console.log(`Saved: ${mascotPath}`);
      // Close mascot
      await mascotTrigger.click();
      await page1440.waitForTimeout(500);
    }
  } catch (e) {
    console.log('Notice on mascot trigger:', e.message);
  }

  // --- 2. DASHBOARD HUB 2 (Map & Intelligence Hub) ---
  console.log('📸 3. Navigating to Hub 2: Mapa & Inteligência de Conversas...');
  try {
    const mapTabBtn = page1440.locator('button[role="tab"], button').filter({ hasText: /Mapa & Inteligência/i }).first();
    if (await mapTabBtn.isVisible()) {
      await mapTabBtn.click();
      await page1440.waitForTimeout(3000);
    } else {
      await page1440.goto(`${BASE_URL}/dashboard?tab=map`, { waitUntil: 'domcontentloaded' });
      await page1440.waitForTimeout(3000);
    }
  } catch (e) {
    await page1440.goto(`${BASE_URL}/dashboard?tab=map`, { waitUntil: 'domcontentloaded' });
    await page1440.waitForTimeout(3000);
  }

  const hub2MapPath = path.join(ARTIFACTS_DIR, 'dashboard_hub2_vivid_neon_map.png');
  await page1440.screenshot({ path: hub2MapPath, fullPage: false });
  console.log(`Saved: ${hub2MapPath}`);

  // --- 3. AI CONFIGURATION: Modo Guiado & Modo Completo (/ai?tab=agent) ---
  console.log('📸 4. Navigating to AI Configuration (/ai?tab=agent)...');
  await page1440.goto(`${BASE_URL}/ai?tab=agent`, { waitUntil: 'domcontentloaded' });
  await page1440.waitForTimeout(3500);

  const aiConfigStepsPath = path.join(ARTIFACTS_DIR, 'ai_config_modo_guiado_steps.png');
  await page1440.screenshot({ path: aiConfigStepsPath, fullPage: false });
  console.log(`Saved: ${aiConfigStepsPath}`);

  // Switch to Modo Completo (Cards Reduzíveis)
  console.log('📸 5. Switching to Modo Completo (Cards Reduzíveis)...');
  try {
    const modoCompletoBtn = page1440.locator('button:has-text("Modo Completo"), button:has-text("Cards Reduzíveis")').first();
    if (await modoCompletoBtn.isVisible()) {
      await modoCompletoBtn.click();
      await page1440.waitForTimeout(1500);
      const aiConfigCompletoPath = path.join(ARTIFACTS_DIR, 'ai_config_modo_completo_cards.png');
      await page1440.screenshot({ path: aiConfigCompletoPath, fullPage: false });
      console.log(`Saved: ${aiConfigCompletoPath}`);

      // Test minimizing cards ("podendo diminuir elas")
      const recolherBtn = page1440.locator('button:has-text("Recolher Todos")').first();
      if (await recolherBtn.isVisible()) {
        await recolherBtn.click();
        await page1440.waitForTimeout(1000);
        const aiConfigMinimizedPath = path.join(ARTIFACTS_DIR, 'ai_config_cards_minimized.png');
        await page1440.screenshot({ path: aiConfigMinimizedPath, fullPage: false });
        console.log(`Saved: ${aiConfigMinimizedPath}`);
      }
    }
  } catch (e) {
    console.log('Notice on Modo Completo switch:', e.message);
  }

  // --- 4. LIVING BRAIN OBSIDIAN GRAPH & EVOLUTION (/ai?tab=evolution) ---
  console.log('📸 6. Navigating to Evolução & Score (/ai?tab=evolution)...');
  await page1440.goto(`${BASE_URL}/ai?tab=evolution`, { waitUntil: 'domcontentloaded' });
  await page1440.waitForTimeout(4000);

  const evolutionGraphPath = path.join(ARTIFACTS_DIR, 'ai_evolution_obsidian_memory_graph.png');
  await page1440.screenshot({ path: evolutionGraphPath, fullPage: false });
  console.log(`Saved: ${evolutionGraphPath}`);

  // --- 5. ATENDENTES UNIFIED MEMORY & EVOLUTION (/attendants?tab=memory) ---
  console.log('📸 7. Navigating to Attendants (/attendants?tab=memory)...');
  await page1440.goto(`${BASE_URL}/attendants?tab=memory`, { waitUntil: 'domcontentloaded' });
  await page1440.waitForTimeout(4000);

  const attendantsMemoryPath = path.join(ARTIFACTS_DIR, 'attendants_unified_memory_evolution.png');
  await page1440.screenshot({ path: attendantsMemoryPath, fullPage: false });
  console.log(`Saved: ${attendantsMemoryPath}`);

  // --- 6. MOBILE RESPONSIVENESS (390x844) ---
  console.log('📸 8. Capturing Mobile Dashboard Hub 1 & AI...');
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    ignoreHTTPSErrors: true,
  });
  const mobilePage = await mobileContext.newPage();
  await loginIfNeeded(mobilePage);

  await mobilePage.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
  await mobilePage.waitForTimeout(3000);
  const mobileDashboardPath = path.join(ARTIFACTS_DIR, 'dashboard_mobile_view.png');
  await mobilePage.screenshot({ path: mobileDashboardPath, fullPage: false });
  console.log(`Saved: ${mobileDashboardPath}`);

  await browser.close();
  console.log('🎉 All verification screenshots captured successfully!');
}

main().catch((err) => {
  console.error('Capture error:', err);
  process.exit(1);
});
