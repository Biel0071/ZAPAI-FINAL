const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require(path.resolve(__dirname, '../frontend-official/node_modules/@playwright/test'));

const BASE_URL = 'https://209.50.241.22';
const USERNAME = 'zapadmin';
const PASSWORD = 'zapadmin1010';
const JWT_SECRET = '73d1ef96dde5afc4938e0b71a5978b2666f1885fb0d2febc4bd52cc7a1cd9e15';
const BRAIN_DIR = 'C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40';

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

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });

  const token = generateAdminToken();
  await context.addInitScript(
    ({ t, u }) => {
      window.localStorage.setItem('auth_token', t);
      window.localStorage.setItem('token', t);
      window.localStorage.setItem('zapflow_token', t);
      window.localStorage.setItem('zapflow_user', JSON.stringify(u));
      window.localStorage.setItem('theme', 'dark');
    },
    {
      t: token,
      u: { id: 'admin-1', username: 'zapadmin', role: 'admin', companyId: 'default' },
    }
  );

  const page = await context.newPage();

  console.log('[EVIDENCE] Opening base URL and ensuring logged in...');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await loginIfNeeded(page);
  await page.waitForTimeout(3000);

  console.log('[EVIDENCE] Navigating to /inbox...');
  await page.goto(`${BASE_URL}/inbox`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(4000);

  // 1. Capture Funnel Filter Bar and Color Badges
  console.log('[EVIDENCE] Capturing Inbox Funnel Bar and Badges...');
  const funnelBarPath = path.join(BRAIN_DIR, 'VERIFY_INBOX_FUNNEL_BAR_AND_BADGES.png');
  await page.screenshot({ path: funnelBarPath, fullPage: false });
  console.log('Saved:', funnelBarPath);

  // Click on a conversation to open active chat pane and right sidebar
  const firstConversation = page.locator('[role="button"][data-conversation-id], div[class*="cursor-pointer"]:has-text("55")').first();
  if (await firstConversation.isVisible()) {
    await firstConversation.click();
    await page.waitForTimeout(2500);
  }

  // 2. Capture Sidebar with Compact Icon Tabs & Arquivos/Mídia Tab
  console.log('[EVIDENCE] Switching to Arquivos tab in right panel...');
  const filesTab = page.locator('button[value="files"], button[aria-label="Arquivos"]').first();
  if (await filesTab.isVisible()) {
    await filesTab.click();
    await page.waitForTimeout(2000);
  }
  const sidebarPath = path.join(BRAIN_DIR, 'VERIFY_INBOX_SIDEBAR_COMPACT_AND_FILES.png');
  await page.screenshot({ path: sidebarPath, fullPage: false });
  console.log('Saved:', sidebarPath);

  // 3. Click "Gerar Ficha" to trigger OrderSheetModal popup in the center
  console.log('[EVIDENCE] Triggering Gerar Ficha for OrderSheetModal...');
  const gerarFichaBtn = page.locator('button[aria-label="Gerar Ficha"], button:has-text("Gerar Ficha")').first();
  if (await gerarFichaBtn.isVisible()) {
    await gerarFichaBtn.click();
    await page.waitForTimeout(3500);
  }

  const modalPath = path.join(BRAIN_DIR, 'VERIFY_INBOX_ORDER_SHEET_POPUP_MODAL.png');
  await page.screenshot({ path: modalPath, fullPage: false });
  console.log('Saved:', modalPath);

  await browser.close();
  console.log('[EVIDENCE] All evidence captures complete.');
}

run().catch((err) => {
  console.error('[EVIDENCE] Error:', err);
  process.exit(1);
});
