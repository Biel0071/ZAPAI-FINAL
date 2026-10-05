const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('../frontend-official/node_modules/@playwright/test/index.js');

const BASE_URL = 'http://localhost:8081';
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
    policies: 'Entrega rápida em até 24h na Grande SP. Pagamento via Pix com 5% de desconto ou boleto faturado em até 28 dias.',
    catalog_summary: 'Cimento, argamassa, tijolos, pisos, ferragens, tintas e ferramentas para construção pesada e acabamento.',
    knowledge: 'Catálogo oficial 2026 com mais de 3.200 itens em estoque. Frete grátis para compras acima de R$ 500,00.',
    theme_color: '#10b981',
    attendant_name: 'Camila',
    attendant_role: 'Vendas & Cotações Rápidas',
    numbers: [
      {
        id: 'conn-1',
        sessionId: 'default',
        sessionName: 'WhatsApp Vendas Oficial',
        phone: '+55 11 98765-4321',
        status: 'CONNECTED',
        attendant: {
          key: 'camila',
          name: 'Camila',
          role: 'Vendas & Orçamentos',
          active: true,
          avatar: '/assets/evolution/camila_avatar.png',
        },
      },
      {
        id: 'conn-2',
        sessionId: 'suporte-loja',
        sessionName: 'WhatsApp Suporte & Entregas',
        phone: '+55 11 97654-3210',
        status: 'CONNECTED',
        attendant: {
          key: 'rafael',
          name: 'Rafael',
          role: 'Suporte & Entregas',
          active: true,
          avatar: '/assets/evolution/joao_avatar.png',
        },
      },
    ],
    attendants: [
      { key: 'camila', name: 'Camila', role: 'Vendas & Orçamentos', active: true },
      { key: 'rafael', name: 'Rafael', role: 'Suporte & Entregas', active: true },
    ],
  },
  {
    id: 'store-2',
    name: 'Depósito Mais - Filial Campinas',
    segment: 'Materiais de Construção & Hidráulica',
    address: 'Rod. Dom Pedro I, km 132 - Campinas, SP',
    phone: '+55 19 3789-4000',
    website: 'https://campinas.depositomais.com.br',
    business_hours: 'Segunda a Sexta das 07:30 às 18:00',
    policies: 'Entregas na região metropolitana de Campinas em até 48h. Pagamento via cartão em até 10x sem juros.',
    catalog_summary: 'Especializada em hidráulica pesada, tubos e conexões Tigre, louças e metais sanitários.',
    knowledge: 'Linha completa Deca e Tigre com estoque para pronta retirada.',
    theme_color: '#0ea5e9',
    attendant_name: 'Julia',
    attendant_role: 'Atendimento & Cotações',
    numbers: [
      {
        id: 'conn-3',
        sessionId: 'campinas-filial',
        sessionName: 'WhatsApp Filial Campinas',
        phone: '+55 19 99876-5432',
        status: 'CONNECTED',
        attendant: {
          key: 'julia',
          name: 'Julia',
          role: 'Atendimento & Vendas',
          active: true,
          avatar: '/assets/evolution/marina_avatar.png',
        },
      },
    ],
    attendants: [
      { key: 'julia', name: 'Julia', role: 'Atendimento & Vendas', active: true },
    ],
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
      personalityType: 'comercial',
    },
  },
  {
    id: 'suporte-loja',
    sessionId: 'suporte-loja',
    name: 'WhatsApp Suporte & Entregas',
    phone: '+55 11 97654-3210',
    status: 'CONNECTED',
    storeId: 'store-1',
    linkedAgent: {
      key: 'rafael',
      name: 'Rafael',
      role: 'Suporte & Entregas',
      status: 'active',
      active: true,
      avatar: '/assets/evolution/joao_avatar.png',
      storeId: 'store-1',
      personalityType: 'tecnico',
    },
  },
  {
    id: 'campinas-filial',
    sessionId: 'campinas-filial',
    name: 'WhatsApp Filial Campinas',
    phone: '+55 19 99876-5432',
    status: 'CONNECTED',
    storeId: 'store-2',
    linkedAgent: {
      key: 'julia',
      name: 'Julia',
      role: 'Atendimento & Vendas',
      status: 'active',
      active: true,
      avatar: '/assets/evolution/marina_avatar.png',
      storeId: 'store-2',
      personalityType: 'consultivo',
    },
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
    prompt: 'Você é Camila, atendente consultiva de vendas da loja Depósito Mais. Atenda com cordialidade, apresente preços com precisão e ofereça condições facilitadas no Pix.',
    stats: {
      chatsToday: 142,
      slaPercent: 97,
      satisfactionCsat: 98,
      avgResponseTime: '16s',
      conversions: 28,
    },
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
    prompt: 'Você é Rafael, especialista em pós-venda e logística da loja Depósito Mais. Localize pedidos e informe prazos de entrega com exatidão.',
    stats: {
      chatsToday: 58,
      slaPercent: 99,
      satisfactionCsat: 96,
      avgResponseTime: '12s',
      conversions: 14,
    },
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
    prompt: 'Você é Julia, consultora de materiais hidráulicos da filial Campinas. Recomende conexões Tigre e louças Deca para clientes locais.',
    stats: {
      chatsToday: 83,
      slaPercent: 95,
      satisfactionCsat: 99,
      avgResponseTime: '19s',
      conversions: 19,
    },
  },
];

async function setupPage(page) {
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
    localStorage.setItem('zapflow_sidebar_collapsed', 'false');
  }, { token });

  // Unified API route mock handlers
  await page.route('**/*', (route) => {
    const url = route.request().url();
    // Never intercept static bundled assets or images
    if (
      url.includes('/assets/') ||
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
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, stores: MOCK_STORES }),
      });
    }
    if (url.includes('/config/ai-agents') || url.includes('/ai/agents')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, agents: MOCK_AGENTS }),
      });
    }
    if (
      url.includes('/sessions/status') ||
      url.includes('/api/sessions') ||
      url.includes('/api/connections') ||
      url.endsWith('/sessions') ||
      url.endsWith('/connections')
    ) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, sessions: MOCK_CONNECTIONS, data: { sessions: MOCK_CONNECTIONS } }),
      });
    }
    if (url.includes('/ai/status')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ enabled: true, active: true, status: 'active' }),
      });
    }
    if (url.includes('/system/health')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', uptime: 36000 }),
      });
    }
    if (url.includes('/conversations')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ conversations: [] }),
      });
    }
    return route.continue();
  });
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  console.log('Browser launched for capturing screenshots...');

  // 1. Desktop context
  const desktopCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const desktopPage = await desktopCtx.newPage();
  await setupPage(desktopPage);

  // Screen 1: Conexões (showing linked attendant card)
  console.log('Capturing Conexões desktop...');
  await desktopPage.goto(`${BASE_URL}/connections`, { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(1500);
  await desktopPage.screenshot({
    path: path.join(ARTIFACTS_DIR, 'screenshot_conexoes_linked_attendant.png'),
    fullPage: false,
  });

  // Screen 2: Conexões (open switch attendant modal)
  console.log('Capturing Conexões switch modal...');
  const switchBtn = desktopPage.locator('button:has-text("Trocar")').first();
  if (await switchBtn.isVisible()) {
    await switchBtn.click();
    await desktopPage.waitForTimeout(600);
    await desktopPage.screenshot({
      path: path.join(ARTIFACTS_DIR, 'screenshot_conexoes_switch_attendant_modal.png'),
      fullPage: false,
    });
    // Close modal
    await desktopPage.keyboard.press('Escape');
    await desktopPage.waitForTimeout(400);
  }

  // Screen 3: Lojas (/stores)
  console.log('Capturing Lojas desktop...');
  await desktopPage.goto(`${BASE_URL}/stores`, { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(1500);
  await desktopPage.screenshot({
    path: path.join(ARTIFACTS_DIR, 'screenshot_lojas_store_profiles.png'),
    fullPage: false,
  });

  // Screen 4: Lojas (Store edit dialog)
  console.log('Capturing Lojas store profile edit dialog...');
  const editBtn = desktopPage.locator('button:has-text("Editar Perfil")').first();
  if (await editBtn.isVisible()) {
    await editBtn.click();
    await desktopPage.waitForTimeout(600);
    await desktopPage.screenshot({
      path: path.join(ARTIFACTS_DIR, 'screenshot_lojas_edit_profile_dialog.png'),
      fullPage: false,
    });
    await desktopPage.keyboard.press('Escape');
    await desktopPage.waitForTimeout(400);
  }

  // Screen 5: Atendentes (/attendants)
  console.log('Capturing Atendentes desktop...');
  await desktopPage.goto(`${BASE_URL}/attendants`, { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(1500);
  await desktopPage.screenshot({
    path: path.join(ARTIFACTS_DIR, 'screenshot_atendentes_living_workspace.png'),
    fullPage: false,
  });

  // Screen 6: Atendentes 5-step New Attendant Wizard
  console.log('Capturing 5-step Attendant Wizard...');
  const newAttendantBtn = desktopPage.locator('button:has-text("Novo Atendente")').first();
  if (await newAttendantBtn.isVisible()) {
    await newAttendantBtn.click();
    await desktopPage.waitForTimeout(800);
    await desktopPage.screenshot({
      path: path.join(ARTIFACTS_DIR, 'screenshot_wizard_store_inheritance.png'),
      fullPage: false,
    });
    await desktopPage.keyboard.press('Escape');
    await desktopPage.waitForTimeout(400);
  }

  // Screen 7: Assistente ZAI (/assistant)
  console.log('Capturing Assistente ZAI desktop...');
  await desktopPage.goto(`${BASE_URL}/assistant`, { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(1500);
  await desktopPage.screenshot({
    path: path.join(ARTIFACTS_DIR, 'screenshot_assistente_zai_copilot.png'),
    fullPage: false,
  });

  // 2. Mobile Context (390x844 - iPhone 14 / Standard Mobile)
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  });
  const mobilePage = await mobileCtx.newPage();
  await setupPage(mobilePage);

  // Screen 8: Mobile Atendentes
  console.log('Capturing Atendentes mobile...');
  await mobilePage.goto(`${BASE_URL}/attendants`, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1500);
  await mobilePage.screenshot({
    path: path.join(ARTIFACTS_DIR, 'screenshot_mobile_atendentes.png'),
    fullPage: false,
  });

  // Screen 9: Mobile Lojas
  console.log('Capturing Lojas mobile...');
  await mobilePage.goto(`${BASE_URL}/stores`, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1500);
  await mobilePage.screenshot({
    path: path.join(ARTIFACTS_DIR, 'screenshot_mobile_lojas.png'),
    fullPage: false,
  });

  // Screen 10: Mobile Conexões
  console.log('Capturing Conexões mobile...');
  await mobilePage.goto(`${BASE_URL}/connections`, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1500);
  await mobilePage.screenshot({
    path: path.join(ARTIFACTS_DIR, 'screenshot_mobile_conexoes.png'),
    fullPage: false,
  });

  await browser.close();
  console.log('All screenshots captured successfully!');
}

run().catch((err) => {
  console.error('Capture error:', err);
  process.exit(1);
});
