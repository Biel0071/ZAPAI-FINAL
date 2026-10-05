const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('../frontend-official/node_modules/@playwright/test/index.js');

const PORT = 8081;
const BASE_URL = `http://localhost:${PORT}`;
const ARTIFACTS_DIR = 'C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40';
const JWT_SECRET = '73d1ef96dde5afc4938e0b71a5978b2666f1885fb0d2febc4bd52cc7a1cd9e15';

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

const MOCK_STORES = [
  {
    id: 'store-1',
    name: 'Depósito Mais - Matriz',
    segment: 'Materiais de Construção & Reforma',
    address: 'Av. dos Bandeirantes, 1200 - São Paulo, SP',
    phone: '+55 11 3245-8800',
    website: 'https://depositomais.com.br',
    business_hours: 'Segunda a Sexta das 07:00 às 18:00, Sábados das 08:00 às 13:00',
    policies: 'Entrega rápida em até 24h na Grande SP. Pagamento via Pix com 5% de desconto.',
    catalog_summary: 'Cimento, tijolos, pisos, ferragens e tintas.',
    theme_color: '#10b981',
    attendant_name: 'Camila',
    attendant_role: 'Vendas & Cotações Rápidas',
  },
  {
    id: 'store-2',
    name: 'Depósito Mais - Filial Campinas',
    segment: 'Acabamentos & Hidráulica',
    address: 'Rod. Dom Pedro I, km 132 - Campinas, SP',
    phone: '+55 19 3788-9000',
    website: 'https://campinas.depositomais.com.br',
    business_hours: 'Segunda a Sexta das 08:00 às 18:00',
    policies: 'Frete regional próprio.',
    catalog_summary: 'Tubos, conexões Tigre, louças e metais Deca.',
    theme_color: '#0ea5e9',
    attendant_name: 'Julia',
    attendant_role: 'Atendimento & Cotações',
  },
];

const MOCK_AGENTS = [
  {
    key: 'camila',
    name: 'Camila',
    role: 'Vendas & Orçamentos',
    sector: 'Vendas',
    active: true,
    status: 'active',
    storeId: 'store-1',
    inheritStoreProfile: true,
    sessionId: 'default',
    channels: ['whatsapp', 'inbox'],
    avatar: '/assets/evolution/camila_avatar.png',
    personalityType: 'comercial',
    character: {
      gender: 'female',
      outfit: 'uniforme_vendas',
      theme: 'emerald',
      headset: true,
      badge: true,
    },
    appearance: {
      gender: 'female',
      skinTone: '#f5c6a5',
      hairStyle: 'ponytail',
      hairColor: '#4a2c11',
      clothingStyle: 'uniforme_loja',
      clothingColor: '#10b981',
      accessories: ['headset', 'cracha'],
    },
    prompt: 'Você é Camila, atendente consultiva de vendas da loja Depósito Mais.',
    stats: { chatsToday: 142, slaPercent: 97, satisfactionCsat: 98, avgResponseTime: '16s', conversions: 28 },
  },
  {
    key: 'rafael',
    name: 'Rafael',
    role: 'Suporte & Entregas',
    sector: 'Suporte',
    active: true,
    status: 'active',
    storeId: 'store-1',
    inheritStoreProfile: true,
    sessionId: 'suporte-loja',
    channels: ['whatsapp', 'inbox'],
    avatar: '/assets/evolution/joao_avatar.png',
    personalityType: 'tecnico',
    character: {
      gender: 'male',
      outfit: 'executivo',
      theme: 'cyan',
      headset: true,
      badge: true,
    },
    appearance: {
      gender: 'male',
      skinTone: '#e0ac69',
      hairStyle: 'short_fade',
      hairColor: '#2b1d0c',
      clothingStyle: 'polo_comercial',
      clothingColor: '#0ea5e9',
      accessories: ['headset', 'cracha'],
    },
    prompt: 'Você é Rafael, especialista em pós-venda da loja Depósito Mais.',
    stats: { chatsToday: 58, slaPercent: 99, satisfactionCsat: 96, avgResponseTime: '12s', conversions: 14 },
  },
  {
    key: 'julia',
    name: 'Julia',
    role: 'Atendimento & Vendas',
    sector: 'Vendas',
    active: true,
    status: 'active',
    storeId: 'store-2',
    inheritStoreProfile: true,
    sessionId: 'campinas-filial',
    channels: ['whatsapp', 'inbox'],
    avatar: '/assets/evolution/marina_avatar.png',
    personalityType: 'consultivo',
    character: {
      gender: 'female',
      outfit: 'casual',
      theme: 'violet',
      headset: false,
      badge: true,
    },
    appearance: {
      gender: 'female',
      skinTone: '#f8d9c2',
      hairStyle: 'wavy_long',
      hairColor: '#6a381f',
      clothingStyle: 'social_executivo',
      clothingColor: '#8b5cf6',
      accessories: ['headset', 'cracha'],
    },
    prompt: 'Você é Julia, consultora de materiais da filial Campinas.',
    stats: { chatsToday: 83, slaPercent: 95, satisfactionCsat: 99, avgResponseTime: '19s', conversions: 19 },
  },
  {
    key: 'zaibot',
    name: 'ZAIBOT',
    role: 'Inteligência Administrativa & Copiloto',
    sector: 'Plataforma',
    active: true,
    status: 'active',
    isPlatformAssistant: true,
    channels: ['admin'],
    avatar: '/assets/mascot/zaibot_avatar.png',
    appearance: {
      gender: 'robot',
      skinTone: '#ffffff',
      hairStyle: 'buzz_cut',
      hairColor: '#00f090',
      clothingStyle: 'casual_tech',
      clothingColor: '#00f090',
      accessories: ['headset'],
    },
  },
];

const MOCK_CONNECTIONS = [
  {
    id: 'default',
    sessionId: 'default',
    name: 'WhatsApp Vendas Oficial',
    phone: '+55 11 98765-4321',
    status: 'CONNECTED',
    storeId: 'store-1',
    linkedAgent: {
      key: 'camila',
      name: 'Camila',
      role: 'Vendas & Orçamentos',
      status: 'active',
      active: true,
      avatar: '/assets/evolution/camila_avatar.png',
      storeId: 'store-1',
    },
  },
];

async function isPortOpen(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}`, () => resolve(true));
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function setupPageAuthAndApi(page) {
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
    localStorage.setItem('auth-storage', JSON.stringify({
      state: { token, user: { id: 1, role: 'master_admin', username: 'zapadmin' }, isAuthenticated: true, companyId: 'default' },
      version: 0,
    }));
    localStorage.setItem('zapai_admin_auth_session', JSON.stringify(session));
    localStorage.setItem('token', token);
    localStorage.setItem('auth_token', token);
    localStorage.setItem('company_id', 'default');
    localStorage.setItem('tenant_id', 'default');
    localStorage.setItem('zapflow_sidebar_collapsed', 'false');
  }, { token });

  await page.route('**/*', (route) => {
    const request = route.request();
    const url = request.url();
    const resourceType = request.resourceType();

    // Never intercept main document navigation, scripts, stylesheets, fonts or images
    if (
      ['document', 'stylesheet', 'script', 'image', 'font', 'media'].includes(resourceType) ||
      url.includes('/assets/') ||
      url.endsWith('.html') ||
      url.endsWith('.js') ||
      url.endsWith('.css') ||
      url.endsWith('.png') ||
      url.endsWith('.jpg') ||
      url.endsWith('.svg') ||
      url.endsWith('.woff2')
    ) {
      return route.continue();
    }

    if (url.includes('/api/stores') || url.endsWith('/stores')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, stores: MOCK_STORES }) });
    }
    if (url.includes('/config/ai-agents') || url.includes('/ai/agents')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, agents: MOCK_AGENTS }) });
    }
    if (url.includes('/connections') || url.includes('/sessions')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_CONNECTIONS) });
    }
    if (url.includes('/api/auth/me')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, username: 'zapadmin', role: 'master', companyId: 'default' }) });
    }
    if (url.includes('/api/ai/copilot/chat')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reply: 'Assistente ZAI operacional pronto para auditar ou configurar atendentes.' }) });
    }

    if (url.includes('/api/') || url.includes('/config/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    }

    return route.continue();
  });
}

async function runCaptures(suffix = '') {
  console.log(`🚀 Starting capture run ${suffix}...`);

  let previewProcess = null;
  const running = await isPortOpen(PORT);
  if (!running) {
    console.log(`Starting Vite preview on port ${PORT}...`);
    previewProcess = spawn('npx', ['vite', 'preview', '--port', String(PORT)], {
      cwd: path.resolve(__dirname, '../frontend-official'),
      stdio: 'inherit',
      shell: true,
    });
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      if (await isPortOpen(PORT)) break;
    }
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'],
  });

  try {
    // 1. Desktop Context
    const desktopContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: 'dark',
      ignoreHTTPSErrors: true,
    });
    const desktopPage = await desktopContext.newPage();
    await setupPageAuthAndApi(desktopPage);

    console.log('Navigating to Desktop Atendentes...');
    await desktopPage.goto(`${BASE_URL}/attendants`, { waitUntil: 'domcontentloaded' });
    await desktopPage.waitForTimeout(3000);

    // 01_desktop_team.png: Overview showing store tabs, Camila, Rafael, Julia cards and Camila workspace
    const p1 = path.join(ARTIFACTS_DIR, `01_desktop_team${suffix}.png`);
    await desktopPage.screenshot({ path: p1, fullPage: false });
    console.log(`Saved: ${p1}`);

    // 02_desktop_working.png: Camila WORKING at luxury 2.5D workstation
    const p2 = path.join(ARTIFACTS_DIR, `02_desktop_working${suffix}.png`);
    await desktopPage.screenshot({ path: p2, fullPage: false });
    console.log(`Saved: ${p2}`);

    // Test a message in sandbox to trigger THINKING / RESPONDING state
    const inputField = desktopPage.locator('input[placeholder*="Digite uma dúvida"]').first();
    const sendBtn = desktopPage.locator('button:has-text("Enviar")').first();
    if (await inputField.isVisible()) {
      await inputField.fill('Qual o horário de entrega e valor do cimento CP-II?');
      if (await sendBtn.isVisible()) {
        await sendBtn.click();
        await desktopPage.waitForTimeout(600);
      }
    }
    // 03_desktop_idle.png: Active attendant responding / dialog
    const p3 = path.join(ARTIFACTS_DIR, `03_desktop_idle${suffix}.png`);
    await desktopPage.screenshot({ path: p3, fullPage: false });
    console.log(`Saved: ${p3}`);

    // Switch Camila to OFFLINE (Click "Pausar" on Camila's card)
    const pauseBtn = desktopPage.locator('button:has-text("Pausar")').first();
    if (await pauseBtn.isVisible()) {
      await pauseBtn.click();
      await desktopPage.waitForTimeout(1500);
    }
    // 04_desktop_offline.png: Camila OFFLINE in standing pose
    const p4 = path.join(ARTIFACTS_DIR, `04_desktop_offline${suffix}.png`);
    await desktopPage.screenshot({ path: p4, fullPage: false });
    console.log(`Saved: ${p4}`);

    // Re-activate Camila
    const activateBtn = desktopPage.locator('button:has-text("Ativar")').first();
    if (await activateBtn.isVisible()) {
      await activateBtn.click();
      await desktopPage.waitForTimeout(1000);
    }

    // Switch to ZAIBOT in Assistente ZAI
    console.log('Navigating to Assistente ZAI for ZAIBOT 3D copilot...');
    await desktopPage.goto(`${BASE_URL}/assistant`, { waitUntil: 'domcontentloaded' });
    await desktopPage.waitForTimeout(3000);

    // 05_desktop_zaibot.png: ZAIBOT 3D robot mascot working in futuristic command lab
    const p5 = path.join(ARTIFACTS_DIR, `05_desktop_zaibot${suffix}.png`);
    await desktopPage.screenshot({ path: p5, fullPage: false });
    console.log(`Saved: ${p5}`);

    await desktopContext.close();

    // 2. Mobile Context (AI / Atendentes Overview)
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      colorScheme: 'dark',
      ignoreHTTPSErrors: true,
    });
    const mobilePage = await mobileContext.newPage();
    await setupPageAuthAndApi(mobilePage);

    await mobilePage.goto(`${BASE_URL}/attendants`, { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForTimeout(3000);

    // 06_mobile_ai.png: Mobile attendant catalog and store badges
    const p6 = path.join(ARTIFACTS_DIR, `06_mobile_ai${suffix}.png`);
    await mobilePage.screenshot({ path: p6, fullPage: false });
    console.log(`Saved: ${p6}`);

    // Open ZAIBOT drawer on mobile
    const zaibotDrawerBtn = mobilePage.locator('button[aria-label*="Assistente ZAI"], button:has-text("ZAI"), button:has-text("ZAIBOT")').first();
    if (await zaibotDrawerBtn.isVisible()) {
      await zaibotDrawerBtn.click();
      await mobilePage.waitForTimeout(1500);
    }
    // 07_mobile_zaibot.png: Mobile ZAIBOT Copilot drawer
    const p7 = path.join(ARTIFACTS_DIR, `07_mobile_zaibot${suffix}.png`);
    await mobilePage.screenshot({ path: p7, fullPage: false });
    console.log(`Saved: ${p7}`);

    // 08_mobile_agent.png: Scroll to 2.5D Living Workstation on Mobile
    const workspaceCard = mobilePage.locator('text=Workspace: Camila').first();
    if (await workspaceCard.isVisible()) {
      await workspaceCard.scrollIntoViewIfNeeded();
      await mobilePage.waitForTimeout(1000);
    }
    const p8 = path.join(ARTIFACTS_DIR, `08_mobile_agent${suffix}.png`);
    await mobilePage.screenshot({ path: p8, fullPage: false });
    console.log(`Saved: ${p8}`);

    await mobileContext.close();
    console.log('✅ Capture run complete!');
  } finally {
    await browser.close();
    if (previewProcess) {
      previewProcess.kill();
    }
  }
}

runCaptures(process.argv[2] || '').catch(console.error);
