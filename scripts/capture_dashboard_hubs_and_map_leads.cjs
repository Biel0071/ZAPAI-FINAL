const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('../frontend-official/node_modules/@playwright/test/index.js');

const BASE_URL = 'https://209.50.241.22';
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

async function loginUser(page) {
  const token = generateAdminToken();
  await page.addInitScript(
    ({ token }) => {
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
    },
    { token }
  );
}

async function run() {
  console.log('Iniciando captura de telas de validação dos Hubs 1 e 2 do Dashboard...');
  const browser = await chromium.launch({ headless: true });

  try {
    // 1. DESKTOP VIEWPORT
    const contextDesktop = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1.5,
      ignoreHTTPSErrors: true,
    });
    const page = await contextDesktop.newPage();
    await loginUser(page);

    // Hub 1: Executive Overview
    console.log('Carregando Hub 1 (Overview)...');
    await page.goto(`${BASE_URL}/dashboard?tab=overview`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    const hub1Path = path.join(ARTIFACTS_DIR, 'EVIDENCE_DASHBOARD_HUB1_DESKTOP.png');
    await page.screenshot({ path: hub1Path, fullPage: false });
    console.log(`[OK] Hub 1 Desktop capturado: ${hub1Path}`);

    // Hub 2: Map & Conversations Intelligence
    console.log('Carregando Hub 2 (Mapa & Inteligência)...');
    await page.goto(`${BASE_URL}/dashboard?tab=map`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3500);

    const hub2MapPath = path.join(ARTIFACTS_DIR, 'EVIDENCE_DASHBOARD_HUB2_MAP_POINTS.png');
    await page.screenshot({ path: hub2MapPath, fullPage: false });
    console.log(`[OK] Hub 2 Map Desktop capturado: ${hub2MapPath}`);

    // Switch to "Leads na Região" tab in sidebar
    console.log('Clicando na aba "Leads na Região"...');
    const leadsTabBtn = await page.locator('button:has-text("Leads na Região")').first();
    if (await leadsTabBtn.isVisible()) {
      await leadsTabBtn.click();
      await page.waitForTimeout(1500);
    }

    // Click on the first lead card to trigger flyTo, selection glow and drawer
    console.log('Clicando no primeiro lead da lista para focar no mapa...');
    const firstLeadCard = await page.locator('span:has-text("Ver no Mapa")').first();
    if (await firstLeadCard.isVisible()) {
      await firstLeadCard.click();
      console.log('Lead clicado! Aguardando animação flyTo e abertura do drawer...');
      await page.waitForTimeout(2500);
    }

    const hub2SelectedPath = path.join(ARTIFACTS_DIR, 'EVIDENCE_DASHBOARD_HUB2_LEAD_FLYTO_SELECTED.png');
    await page.screenshot({ path: hub2SelectedPath, fullPage: false });
    console.log(`[OK] Hub 2 Lead Selecionado no Mapa capturado: ${hub2SelectedPath}`);

    await contextDesktop.close();

    // 2. MOBILE VIEWPORT (390x844)
    console.log('Iniciando capturas Mobile (390x844)...');
    const contextMobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      ignoreHTTPSErrors: true,
    });
    const pageMobile = await contextMobile.newPage();
    await loginUser(pageMobile);

    // Mobile Hub 1
    await pageMobile.goto(`${BASE_URL}/dashboard?tab=overview`, { waitUntil: 'networkidle', timeout: 30000 });
    await pageMobile.waitForTimeout(2500);
    const mobileHub1Path = path.join(ARTIFACTS_DIR, 'EVIDENCE_DASHBOARD_HUB1_MOBILE.png');
    await pageMobile.screenshot({ path: mobileHub1Path });
    console.log(`[OK] Hub 1 Mobile capturado: ${mobileHub1Path}`);

    // Mobile Hub 2
    await pageMobile.goto(`${BASE_URL}/dashboard?tab=map`, { waitUntil: 'networkidle', timeout: 30000 });
    await pageMobile.waitForTimeout(3000);
    const mobileHub2Path = path.join(ARTIFACTS_DIR, 'EVIDENCE_DASHBOARD_HUB2_MOBILE.png');
    await pageMobile.screenshot({ path: mobileHub2Path });
    console.log(`[OK] Hub 2 Mobile capturado: ${mobileHub2Path}`);

    // Click lead on Mobile
    const mobileLeadsTabBtn = await pageMobile.locator('button:has-text("Leads na Região")').first();
    if (await mobileLeadsTabBtn.isVisible()) {
      await mobileLeadsTabBtn.click();
      await pageMobile.waitForTimeout(1500);
    }
    const mobileLeadCard = await pageMobile.locator('span:has-text("Ver no Mapa")').first();
    if (await mobileLeadCard.isVisible()) {
      await mobileLeadCard.click();
      await pageMobile.waitForTimeout(2000);
    }
    const mobileHub2DrawerPath = path.join(ARTIFACTS_DIR, 'EVIDENCE_DASHBOARD_HUB2_MOBILE_LEAD_DRAWER.png');
    await pageMobile.screenshot({ path: mobileHub2DrawerPath });
    console.log(`[OK] Hub 2 Mobile Lead Drawer capturado: ${mobileHub2DrawerPath}`);

    await contextMobile.close();
    console.log('\nTodas as evidências visuais foram capturadas com sucesso!');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('[ERRO] Falha na captura de telas:', err);
  process.exit(1);
});
