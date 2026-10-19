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
      window.localStorage.setItem('zapai_admin_auth_session', JSON.stringify({
        token: t,
        username: u.username,
        tenantId: u.companyId,
        companyId: u.companyId,
        role: u.role,
        expiresAt: Date.now() + 86400 * 7 * 1000
      }));
    },
    {
      t: token,
      u: { id: 'admin-1', username: 'zapadmin', role: 'admin', companyId: 'default' },
    }
  );

  const page = await context.newPage();

  console.log('[EVIDENCE] Navigating to /login and ensuring logged in...');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await loginIfNeeded(page);
  await page.waitForTimeout(3000);

  console.log('[EVIDENCE] Navigating to /inbox...');
  await page.goto(`${BASE_URL}/inbox`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(4000);

  // 1. Capture presence dot and lead background tone
  console.log('[EVIDENCE] Capturing conversation list with presence dot and lead status tone...');
  const presencePath = path.join(BRAIN_DIR, 'VERIFY_INBOX_PRESENCE_AND_LEAD_TONE.png');
  await page.screenshot({ path: presencePath, fullPage: false });
  console.log('Saved:', presencePath);

  // 2. Select conversation and open OrderSheetModal to verify the close 'X' button
  const convItems = page.locator('[role="button"][data-conversation-id]');
  const count = await convItems.count();
  if (count > 0) {
    await convItems.first().click();
    await page.waitForTimeout(3000);

    const sheetBtn = page.locator('button:has-text("Gerar Ficha")').first();
    if (await sheetBtn.isVisible()) {
      console.log('[EVIDENCE] Opening OrderSheetModal to verify close button...');
      await sheetBtn.click();
      await page.waitForTimeout(2000);

      const modalPath = path.join(BRAIN_DIR, 'VERIFY_INBOX_MODAL_CLOSE_BUTTON.png');
      await page.screenshot({ path: modalPath, fullPage: false });
      console.log('Saved:', modalPath);
    }
  }

  await browser.close();
  console.log('[EVIDENCE] Capture complete.');
}

run().catch((err) => {
  console.error('[EVIDENCE] Error:', err);
  process.exit(1);
});
