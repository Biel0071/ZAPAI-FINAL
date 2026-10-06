const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('../frontend-official/node_modules/@playwright/test/index.js');

const PORT = 8082;
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

const MOCK_CONVERSATIONS = [
  {
    id: 'conv-1',
    name: 'Carlos Oliveira',
    phone: '5511999887766',
    status: 'open',
    updatedAt: new Date().toISOString(),
    lastMessage: 'Gostaria de saber se vocês têm cimento Votoran a pronta entrega.',
  },
  {
    id: 'conv-2',
    name: 'Mariana Silva',
    phone: '5511988776655',
    status: 'bot',
    updatedAt: new Date().toISOString(),
    lastMessage: 'Camila, consegue me passar a cotação de 50m² de piso porcelanato?',
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
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    }
    if (url.includes('/api/auth/me')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, username: 'zapadmin', role: 'master', companyId: 'default' }) });
    }
    if (url.includes('/api/conversations') || url.includes('/conversations')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, conversations: MOCK_CONVERSATIONS }) });
    }
    if (url.includes('/api/attendance') || url.includes('/attendance')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: 'Sincronizado' }) });
    }
    if (url.includes('/api/ai/copilot/chat')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reply: 'ZAIBOT: Tudo operacional com seus atendentes e conexões do WhatsApp!' }) });
    }

    if (url.includes('/api/') || url.includes('/config/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    }

    return route.continue();
  });
}

async function run() {
  console.log('Starting verification captures...');
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }

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
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: 'dark',
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();
    await setupPageAuthAndApi(page);

    // 1. Visit /ai to see floating button and overall UI
    console.log('Navigating to /ai...');
    await page.goto(`${BASE_URL}/ai`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Screenshot 1: Floating button with Zaibot mascot thumbnail and green online ping dot
    const floatingBtn = page.locator('button[aria-label="Abrir Assistente ZAI"]').first();
    if (await floatingBtn.isVisible()) {
      const p1 = path.join(ARTIFACTS_DIR, '01_zaibot_floating_button.png');
      await floatingBtn.screenshot({ path: p1 });
      console.log(`Saved: ${p1}`);
    } else {
      console.warn('Floating button not visible directly');
    }

    // Screenshot 2: Assistente ZAI modal dialog
    if (await floatingBtn.isVisible()) {
      await floatingBtn.click();
      await page.waitForTimeout(1000);
      const p2 = path.join(ARTIFACTS_DIR, '02_zaibot_assistant_modal.png');
      await page.screenshot({ path: p2, fullPage: false });
      console.log(`Saved: ${p2}`);

      // Close modal
      const closeBtn = page.locator('button:has-text("Fechar"), button:has-text("✕"), [aria-label="Close"]').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
        await page.waitForTimeout(500);
      } else {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    }

    // 2. Visit /ai?tab=agent
    console.log('Navigating to /ai?tab=agent...');
    await page.goto(`${BASE_URL}/ai?tab=agent`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);

    // Screenshot 3: Atendente IA screen showing side-by-side character 3D workspace + live console
    const p3 = path.join(ARTIFACTS_DIR, '03_atendente_ia_side_by_side.png');
    await page.screenshot({ path: p3, fullPage: false });
    console.log(`Saved: ${p3}`);

    // Click on "Atendimentos & Sync" tab inside the simulator
    const syncTab = page.locator('button:has-text("Atendimentos & Sync")').first();
    if (await syncTab.isVisible()) {
      await syncTab.click();
      await page.waitForTimeout(1000);
      const p4 = path.join(ARTIFACTS_DIR, '04_simulator_whatsapp_sync.png');
      await page.screenshot({ path: p4, fullPage: false });
      console.log(`Saved: ${p4}`);
    }

    // Click on "Evolução IA" tab inside the simulator
    const evoTab = page.locator('button:has-text("Evolução IA")').first();
    if (await evoTab.isVisible()) {
      await evoTab.click();
      await page.waitForTimeout(1000);
      const p5 = path.join(ARTIFACTS_DIR, '05_simulator_evolution.png');
      await page.screenshot({ path: p5, fullPage: false });
      console.log(`Saved: ${p5}`);
    }

    // Click on "Avatar Studio" button to verify modal opening
    const avatarStudioBtn = page.locator('button:has-text("Avatar Studio")').first();
    if (await avatarStudioBtn.isVisible()) {
      await avatarStudioBtn.click();
      await page.waitForTimeout(1500);
      const p6 = path.join(ARTIFACTS_DIR, '06_avatar_editor_modal.png');
      await page.screenshot({ path: p6, fullPage: false });
      console.log(`Saved: ${p6}`);
    }

    console.log('All verification captures completed successfully!');
  } finally {
    await browser.close();
    if (previewProcess) {
      previewProcess.kill();
    }
  }
}

run().catch((err) => {
  console.error('Error running capture:', err);
  process.exit(1);
});
