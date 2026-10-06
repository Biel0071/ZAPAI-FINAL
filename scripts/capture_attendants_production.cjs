const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { chromium } = require('../frontend-official/node_modules/@playwright/test/index.js');

const PORT = 8095;
const BASE_URL = `http://localhost:${PORT}`;
const ARTIFACTS_DIR = 'C:/Users/Dell/.gemini/antigravity/brain/053de275-3784-42c3-a59a-76cec5674dfd';
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

const MOCK_AGENTS = [
  {
    key: 'camila',
    name: 'Camila',
    role: 'Vendas & Atendimento Comercial',
    description: 'Especialista em atendimento rápido e conversão de leads.',
    active: true,
    sessionIds: ['default'],
    storeId: 'store-1',
    avatarConfig: {
      hair: 'hair_03',
      face: 'face_04',
      outfit: 'outfit_05',
      clothing: 'outfit_05',
      accessories: { headset: 'headset_zai_green' },
      style: 'style_vendas',
      body: 'female',
      base: 'female',
      skin: 'peach',
      branding: {
        storeName: 'Depósito Mais',
        primaryColor: '#10b981',
        secondaryColor: '#0f172a',
        accentColor: '#34d399',
        logo: 'ZAI',
      },
    },
    metrics: {
      conversationsToday: 38,
      leadsToday: 14,
      tokensToday: 42800,
      messagesToday: 142,
    },
  },
  {
    key: 'carlos',
    name: 'Carlos',
    role: 'Suporte Técnico & Orçamentos',
    description: 'Especialista em especificações de materiais e cotações técnicas.',
    active: true,
    sessionIds: ['sess-carlos'],
    storeId: 'store-1',
    avatarConfig: {
      hair: 'hair_01',
      face: 'face_01',
      outfit: 'outfit_06',
      clothing: 'outfit_06',
      accessories: { glasses: 'glasses_square_exec' },
      style: 'style_operacional',
      body: 'male',
      base: 'male',
      skin: 'tan',
      branding: {
        storeName: 'Depósito Mais',
        primaryColor: '#0ea5e9',
        secondaryColor: '#0f172a',
        accentColor: '#38bdf8',
        logo: 'ZAI',
      },
    },
    metrics: {
      conversationsToday: 24,
      leadsToday: 8,
      tokensToday: 28400,
      messagesToday: 96,
    },
  },
  {
    key: 'ana',
    name: 'Ana',
    role: 'Pós-Venda & Fidelização',
    description: 'Acompanhamento de entregas, satisfação e resolução de dúvidas.',
    active: false,
    sessionIds: [],
    storeId: 'store-1',
    avatarConfig: {
      hair: 'hair_02',
      face: 'face_02',
      outfit: 'outfit_01',
      clothing: 'outfit_01',
      accessories: {},
      style: 'style_atendimento',
      body: 'female',
      base: 'female',
      skin: 'fair',
      branding: {
        storeName: 'Depósito Mais',
        primaryColor: '#a855f7',
        secondaryColor: '#0f172a',
        accentColor: '#c084fc',
        logo: 'ZAI',
      },
    },
    metrics: {
      conversationsToday: 0,
      leadsToday: 0,
      tokensToday: 0,
      messagesToday: 0,
    },
  },
];

const MOCK_STORES = [
  {
    id: 'store-1',
    name: 'Depósito Mais - Matriz',
    segment: 'Materiais de Construção',
    numbers: [{ sessionId: 'default', phone: '+55 11 98888-1111', status: 'connected' }],
  },
];

const MOCK_SESSIONS = [
  {
    id: 'default',
    sessionId: 'default',
    sessionName: 'WhatsApp Principal',
    status: 'connected',
    phone: '+55 11 98888-1111',
  },
  {
    id: 'sess-carlos',
    sessionId: 'sess-carlos',
    sessionName: 'WhatsApp Técnico',
    status: 'connected',
    phone: '+55 11 98888-2222',
  },
];

async function startServer() {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      'npx.cmd',
      ['vite', 'preview', '--port', String(PORT), '--host', 'localhost'],
      {
        cwd: path.resolve(__dirname, '../frontend-official'),
        stdio: 'pipe',
        shell: true,
      }
    );

    let started = false;
    proc.stdout.on('data', (d) => {
      const msg = d.toString();
      if (!started && (msg.includes('Local:') || msg.includes('http://'))) {
        started = true;
        resolve(proc);
      }
    });

    proc.stderr.on('data', (d) => {
      // console.error(d.toString());
    });

    proc.on('error', reject);
    setTimeout(() => {
      if (!started) resolve(proc);
    }, 4000);
  });
}

async function setupPage(page) {
  const token = generateAdminToken();
  await page.addInitScript(
    ({ t, agents, stores, sessions }) => {
      const authSession = {
        token: t,
        username: 'zapadmin',
        role: 'master',
        issuedAt: Date.now(),
        expiresAt: Date.now() + 86400000,
        remember: true,
      };
      localStorage.setItem('zapai_admin_auth_session', JSON.stringify(authSession));
      sessionStorage.setItem('zapai_admin_auth_session', JSON.stringify(authSession));
      localStorage.setItem('zapflow_view_mode', 'desktop');
      localStorage.setItem('auth_token', t);
      localStorage.setItem('access_token', t);
      localStorage.setItem('token', t);
      localStorage.setItem('tenantId', 'default');
      localStorage.setItem('companyId', 'default');
      localStorage.setItem('tenant_id', 'default');
      localStorage.setItem('company_id', 'default');
      localStorage.setItem('theme', 'dark');
      localStorage.setItem(
        'zapflow_auth_user',
        JSON.stringify({
          id: 'admin',
          username: 'zapadmin',
          name: 'Administrador ZAI',
          role: 'master',
        })
      );
    },
    { t: token, agents: MOCK_AGENTS, stores: MOCK_STORES, sessions: MOCK_SESSIONS }
  );

  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/config/ai-agents') || url.includes('/ai/agents')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, agents: MOCK_AGENTS }),
      });
    }
    if (url.includes('/stores')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, stores: MOCK_STORES }),
      });
    }
    if (url.includes('/connections') || url.includes('/sessions')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SESSIONS),
      });
    }
    if (url.includes('/ai/status') || url.includes('/status')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, active: true, enabled: true, ai: true }),
      });
    }
    if (url.includes('/api/ai/metrics')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            messagesToday: 142,
            tokensToday: 42800,
            conversationsToday: 38,
            leadsToday: 14,
          },
        }),
      });
    }
    if (url.includes('/api/ai/evolution')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          evolution: {
            score: 94,
            level: 'Avançado',
            totalFeedbacks: 120,
            positiveFeedbacks: 114,
            negativeFeedbacks: 6,
            recentLearnings: [
              'Preço do cimento CP-II atualizado para R$ 34,90/saco',
              'Prazo de entrega padrão da Zona Sul alterado para 24h',
            ],
          },
        }),
      });
    }
    if (url.includes('/api/conversations')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'conv-1', contactName: 'Marcos Silva', lastMessage: 'Tem cimento CP-II disponível?' },
          { id: 'conv-2', contactName: 'Engenharia Alfa', lastMessage: 'Qual o frete para 100 sacos?' },
        ]),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });
}

async function run() {
  console.log('Starting preview server on port', PORT);
  const serverProc = await startServer();
  await new Promise((r) => setTimeout(r, 2000));

  try {
    const browser = await chromium.launch({ headless: true });

    // 1. Desktop Viewport: 1440x900
    console.log('Capturing Desktop 1440x900...');
    const ctx1440 = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    const page1440 = await ctx1440.newPage();
    await setupPage(page1440);

    await page1440.goto(`${BASE_URL}/attendants`, { waitUntil: 'networkidle' });
    await page1440.waitForTimeout(2000);

    const shot1440Path = path.join(ARTIFACTS_DIR, 'screenshot_attendants_1440x900.png');
    await page1440.screenshot({ path: shot1440Path, fullPage: false });
    console.log('Saved:', shot1440Path);

    // Click on Rosto category in inline studio
    console.log('Clicking Rosto category...');
    const rostoBtn = page1440.locator('button:has-text("Rosto")').first();
    if (await rostoBtn.isVisible()) {
      await rostoBtn.click();
      await page1440.waitForTimeout(600);
      const shotStudioPath = path.join(ARTIFACTS_DIR, 'screenshot_attendants_rosto_category_1440x900.png');
      await page1440.screenshot({ path: shotStudioPath, fullPage: false });
      console.log('Saved:', shotStudioPath);
    }

    // 2. Desktop Viewport: 1366x768
    console.log('Capturing Desktop 1366x768...');
    const ctx1366 = await browser.newContext({
      viewport: { width: 1366, height: 768 },
      deviceScaleFactor: 1,
    });
    const page1366 = await ctx1366.newPage();
    await setupPage(page1366);

    await page1366.goto(`${BASE_URL}/attendants`, { waitUntil: 'networkidle' });
    await page1366.waitForTimeout(2000);

    const shot1366Path = path.join(ARTIFACTS_DIR, 'screenshot_attendants_1366x768.png');
    await page1366.screenshot({ path: shot1366Path, fullPage: false });
    console.log('Saved:', shot1366Path);

    // 3. Memória & Evolução Tab
    console.log('Capturing Memória & Evolução Tab...');
    const evoTabBtn = page1440.locator('button:has-text("Memória & Evolução")').first();
    if (await evoTabBtn.isVisible()) {
      await evoTabBtn.click();
      await page1440.waitForTimeout(2000);
      const shotEvoPath = path.join(ARTIFACTS_DIR, 'screenshot_attendants_evolution_tab.png');
      await page1440.screenshot({ path: shotEvoPath, fullPage: false });
      console.log('Saved:', shotEvoPath);
    }

    await browser.close();
    console.log('All screenshots captured successfully!');
  } catch (err) {
    console.error('Error during capture:', err);
  } finally {
    if (serverProc) {
      serverProc.kill();
    }
  }
}

run();
