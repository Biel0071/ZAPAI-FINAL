const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { chromium } = require('../frontend-official/node_modules/@playwright/test/index.js');

const PORT = 8086;
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

const MOCK_STORE_DNA = {
  primaryColor: '#10b981',
  secondaryColor: '#0f172a',
  accentColor: '#34d399',
  logo: 'https://images.unsplash.com/photo-1541888946425-d0fbb18f15f7?w=128&auto=format&fit=crop&q=80',
  brandName: 'Depósito Mais',
  defaultClothing: 'clothing_uniform_zai_m',
  defaultAccessories: ['headset_zai_neon', 'badge_magnetic'],
  defaultBadge: true,
  defaultShoes: 'shoes_sneakers_green',
  visualStyle: 'modern_isometric',
};

const MOCK_STORES = [
  {
    id: 'store-1',
    name: 'Depósito Mais - Matriz',
    segment: 'Materiais de Construção & Reforma',
    address: 'Av. dos Bandeirantes, 1200 - São Paulo, SP',
    phone: '+55 11 3245-8800',
    website: 'https://depositomais.com.br',
    business_hours: 'Segunda a Sexta das 07:00 às 18:00',
    policies: 'Entrega rápida em até 24h na Grande SP. Pagamento via Pix com 5% de desconto.',
    catalog_summary: 'Cimento, tijolos, tintas e ferramentas.',
    theme_color: '#10b981',
    settings: {
      storeVisualDNA: MOCK_STORE_DNA,
    },
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
          role: 'Vendas & Cotações',
          active: true,
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
          role: 'Suporte Técnico',
          active: true,
        },
      },
    ],
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
    },
    avatarConfig: {
      id: 'avt-camila',
      agentId: 'camila',
      storeId: 'store-1',
      gender: 'female',
      body: 'body_female_average',
      skin: 'skin_fair',
      face: 'face_female_smile',
      hair: 'hair_fem_long_wavy',
      hairColor: '#451a03',
      eyes: 'eyes_amber',
      eyebrows: 'eyebrows_curved',
      facialHair: 'none',
      glasses: 'none',
      headset: 'headset_zai_neon',
      clothing: 'clothing_uniform_zai_f',
      clothingColor: '#10b981',
      shoes: 'shoes_sneakers_green',
      shoesColor: '#0f172a',
      accessories: {
        badge: 'badge_magnetic',
        headwear: 'none',
        watch: 'watch_smart',
        backpack: 'none',
      },
      workObject: 'tablet_pro',
      badge: true,
      branding: {
        storeName: 'Depósito Mais',
        primaryColor: '#10b981',
        secondaryColor: '#0f172a',
        accentColor: '#34d399',
        logo: 'DEPÓSITO',
        showLogoOnChest: true,
        showLogoOnBadge: true,
      },
      animationState: 'WORKING',
      personalityVisual: {
        posture: 'posture_focused_work',
        expression: 'expression_friendly_smile',
        animationStyle: 'energetic',
      },
      catalogSpriteId: 'sprite_r1_c1_clean',
    },
  },
  {
    key: 'rafael',
    name: 'Rafael',
    role: 'Suporte Técnico & Orçamentos',
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
      outfit: 'casual_polo',
      theme: 'emerald',
      headset: true,
    },
    avatarConfig: {
      id: 'avt-rafael',
      agentId: 'rafael',
      storeId: 'store-1',
      gender: 'male',
      body: 'body_male_average',
      skin: 'skin_tan',
      face: 'face_male_beard_stub',
      hair: 'hair_male_short_sidepart',
      hairColor: '#1e293b',
      eyes: 'eyes_brown',
      eyebrows: 'eyebrows_straight',
      facialHair: 'beard_stubble',
      glasses: 'glasses_wireframe',
      headset: 'headset_zai_neon',
      clothing: 'clothing_uniform_zai_m',
      clothingColor: '#10b981',
      shoes: 'shoes_sneakers_green',
      shoesColor: '#0f172a',
      accessories: {
        badge: 'badge_magnetic',
        headwear: 'none',
        watch: 'watch_smart',
        backpack: 'none',
      },
      workObject: 'laptop_ultrathin',
      badge: true,
      branding: {
        storeName: 'Depósito Mais',
        primaryColor: '#10b981',
        secondaryColor: '#0f172a',
        accentColor: '#34d399',
        logo: 'DEPÓSITO',
        showLogoOnChest: true,
        showLogoOnBadge: true,
      },
      animationState: 'TALKING',
      personalityVisual: {
        posture: 'posture_confident_stand',
        expression: 'expression_analytical_attentive',
        animationStyle: 'calm',
      },
      catalogSpriteId: 'sprite_r1_c4_clean',
    },
  },
];

const MOCK_SESSIONS = [
  {
    id: 'default',
    sessionId: 'default',
    name: 'WhatsApp Vendas Oficial',
    phone: '+55 11 98765-4321',
    status: 'CONNECTED',
    storeId: 'store-1',
  },
  {
    id: 'suporte-loja',
    sessionId: 'suporte-loja',
    name: 'WhatsApp Suporte & Entregas',
    phone: '+55 11 97654-3210',
    status: 'CONNECTED',
    storeId: 'store-1',
  },
];

async function setupPage(page) {
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
      localStorage.setItem('auth_token', token);
      localStorage.setItem('token', token);
      localStorage.setItem('company_id', 'default');
      localStorage.setItem('tenant_id', 'default');
      localStorage.setItem('zapflow_sidebar_collapsed', 'false');
      localStorage.setItem('theme', 'dark');
      document.documentElement.classList.add('dark');
    },
    { token }
  );

  await page.route('**/*', async (route) => {
    const url = route.request().url();

    if (
      url.endsWith('.js') ||
      url.endsWith('.css') ||
      url.endsWith('.png') ||
      url.endsWith('.jpg') ||
      url.endsWith('.svg') ||
      url.endsWith('.woff2')
    ) {
      return route.continue();
    }

    if (url.includes('/visual-dna')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, visualDNA: MOCK_STORE_DNA }),
      });
    }

    if (url.includes('/config/ai-agents') || url.includes('/ai/agents')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, agents: MOCK_AGENTS }),
      });
    }

    if (url.includes('/stores') || url.endsWith('/stores')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, stores: MOCK_STORES }),
      });
    }

    if (
      url.includes('/sessions/status') ||
      url.includes('/api/sessions') ||
      url.includes('/api/connections') ||
      url.includes('/sessions') ||
      url.includes('/connections')
    ) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, sessions: MOCK_SESSIONS }),
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

    return route.continue();
  });
}

async function startServer() {
  return new Promise((resolve, reject) => {
    console.log(`Starting Vite preview server on port ${PORT}...`);
    const proc = spawn('npx', ['vite', 'preview', '--port', String(PORT)], {
      cwd: path.resolve(__dirname, '../frontend-official'),
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let started = false;
    proc.stdout.on('data', (d) => {
      const msg = d.toString();
      console.log('[Server stdout]', msg.trim());
      if (msg.includes('http://localhost:') && !started) {
        started = true;
        resolve(proc);
      }
    });

    proc.stderr.on('data', (d) => {
      console.error('[Server stderr]', d.toString().trim());
    });

    setTimeout(() => {
      if (!started) {
        started = true;
        resolve(proc);
      }
    }, 4000);
  });
}

async function run() {
  let serverProc = null;
  try {
    serverProc = await startServer();
    console.log('Preview server ready! Launching Chromium...');

    const browser = await chromium.launch({ headless: true });

    // 1. Desktop Context
    const desktopCtx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    const desktopPage = await desktopCtx.newPage();
    await setupPage(desktopPage);

    // Screen 1: Attendants Page in Modular Pixel Art Mode
    console.log('1. Capturing /attendants in Modular Pixel Mode...');
    await desktopPage.goto(`${BASE_URL}/attendants`, { waitUntil: 'networkidle' });
    await desktopPage.waitForTimeout(2000);
    console.log('Current URL:', desktopPage.url());

    await desktopPage.screenshot({
      path: path.join(ARTIFACTS_DIR, 'screenshot_attendants_pixel_mode.png'),
      fullPage: false,
    });

    // Screen 2: Switch to 2.5D Executivo Mode
    console.log('2. Switching to 2.5D Executivo mode...');
    const execModeBtn = desktopPage.locator('button:has-text("Executivo 2.5D")').first();
    if (await execModeBtn.isVisible()) {
      await execModeBtn.click();
      await desktopPage.waitForTimeout(1000);
      await desktopPage.screenshot({
        path: path.join(ARTIFACTS_DIR, 'screenshot_attendants_executivo_mode.png'),
        fullPage: false,
      });
      // Switch back to Pixel mode
      const pixelModeBtn = desktopPage.locator('button:has-text("Modular Pixel")').first();
      if (await pixelModeBtn.isVisible()) {
        await pixelModeBtn.click();
        await desktopPage.waitForTimeout(600);
      }
    }

    // Screen 3: Open Avatar Studio Modal for Camila
    console.log('3. Opening Avatar Studio modal...');
    const avatarStudioBtn = desktopPage.locator('button:has-text("Avatar Studio")').first();
    const isVisible = await avatarStudioBtn.isVisible();
    console.log('Avatar Studio button visible:', isVisible);
    if (isVisible) {
      await avatarStudioBtn.click();
      await desktopPage.waitForTimeout(1200);
      await desktopPage.screenshot({
        path: path.join(ARTIFACTS_DIR, 'screenshot_avatar_studio_open.png'),
        fullPage: false,
      });

      // Screen 4: Test Animation State Switcher (WORKING)
      console.log('4. Testing WORKING state in Avatar Studio...');
      const workingBtn = desktopPage.locator('button:has-text("WORKING")').first();
      if (await workingBtn.isVisible()) {
        await workingBtn.click();
        await desktopPage.waitForTimeout(800);
        await desktopPage.screenshot({
          path: path.join(ARTIFACTS_DIR, 'screenshot_avatar_studio_working.png'),
          fullPage: false,
        });
      }

      // Screen 5: Test TALKING state
      console.log('5. Testing TALKING state in Avatar Studio...');
      const talkingBtn = desktopPage.locator('button:has-text("TALKING")').first();
      if (await talkingBtn.isVisible()) {
        await talkingBtn.click();
        await desktopPage.waitForTimeout(800);
        await desktopPage.screenshot({
          path: path.join(ARTIFACTS_DIR, 'screenshot_avatar_studio_talking.png'),
          fullPage: false,
        });
      }

      // Screen 6: Test Roupas Tab
      console.log('6. Testing Roupas Tab in Avatar Studio...');
      const clothingTab = desktopPage.locator('button[role="tab"]:has-text("Roupas")').first();
      if (await clothingTab.isVisible()) {
        await clothingTab.click();
        await desktopPage.waitForTimeout(600);
        await desktopPage.screenshot({
          path: path.join(ARTIFACTS_DIR, 'screenshot_avatar_studio_clothing_tab.png'),
          fullPage: false,
        });
      }

      // Screen 7: Test Acessórios Tab
      console.log('7. Testing Acessórios Tab in Avatar Studio...');
      const accessoriesTab = desktopPage.locator('button[role="tab"]:has-text("Acessórios")').first();
      if (await accessoriesTab.isVisible()) {
        await accessoriesTab.click();
        await desktopPage.waitForTimeout(600);
        await desktopPage.screenshot({
          path: path.join(ARTIFACTS_DIR, 'screenshot_avatar_studio_accessories_tab.png'),
          fullPage: false,
        });
      }

      // Screen 8: Test Loja DNA Tab
      console.log('8. Testing Loja DNA Tab in Avatar Studio...');
      const dnaTab = desktopPage.locator('button[role="tab"]:has-text("Loja DNA")').first();
      if (await dnaTab.isVisible()) {
        await dnaTab.click();
        await desktopPage.waitForTimeout(600);
        await desktopPage.screenshot({
          path: path.join(ARTIFACTS_DIR, 'screenshot_avatar_studio_dna_tab.png'),
          fullPage: false,
        });
      }

      // Close modal
      await desktopPage.keyboard.press('Escape');
      await desktopPage.waitForTimeout(500);
    }

    // Screen 9: Stores Page (/stores) showing Store Visual DNA card
    console.log('9. Capturing /stores with Store Visual DNA...');
    await desktopPage.goto(`${BASE_URL}/stores`, { waitUntil: 'networkidle' });
    await desktopPage.waitForTimeout(1500);
    await desktopPage.screenshot({
      path: path.join(ARTIFACTS_DIR, 'screenshot_stores_visual_dna.png'),
      fullPage: false,
    });

    // 2. Mobile Context (390x844)
    console.log('10. Capturing Mobile Attendants & Avatar Studio...');
    const mobileCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const mobilePage = await mobileCtx.newPage();
    await setupPage(mobilePage);

    await mobilePage.goto(`${BASE_URL}/attendants`, { waitUntil: 'networkidle' });
    await mobilePage.waitForTimeout(1500);
    await mobilePage.screenshot({
      path: path.join(ARTIFACTS_DIR, 'screenshot_mobile_attendants_avatar.png'),
      fullPage: false,
    });

    const mobileStudioBtn = mobilePage.locator('button:has-text("Avatar Studio")').first();
    if (await mobileStudioBtn.isVisible()) {
      await mobileStudioBtn.click();
      await mobilePage.waitForTimeout(1200);
      await mobilePage.screenshot({
        path: path.join(ARTIFACTS_DIR, 'screenshot_mobile_avatar_studio.png'),
        fullPage: false,
      });
    }

    console.log('All screenshots captured successfully!');
    await browser.close();
  } catch (err) {
    console.error('Error during capture:', err);
  } finally {
    if (serverProc) {
      serverProc.kill();
    }
    process.exit(0);
  }
}

run();
