const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('../frontend-official/node_modules/@playwright/test/index.js');

const BASE_URL = 'https://209.50.241.22';
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
  if (page.url().includes('login') || (await page.locator('input[type="password"]').count()) > 0) {
    console.log('Submitting login form...');
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
  console.log('Launching browser to capture Inbox square tabs...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'],
  });

  const token = generateAdminToken();

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true,
  });

  await context.addInitScript((jwt) => {
    const sessionObj = {
      token: jwt,
      username: 'zapadmin',
      role: 'master',
      tenantId: 'default',
      companyId: 'default',
      issuedAt: Date.now(),
      expiresAt: Date.now() + 86400000 * 7,
      remember: true,
    };
    localStorage.setItem('zapai_admin_auth_session', JSON.stringify(sessionObj));
    sessionStorage.setItem('zapai_admin_auth_session', JSON.stringify(sessionObj));
    localStorage.setItem('auth_token', jwt);
    localStorage.setItem('token', jwt);
    localStorage.setItem('auth_user', JSON.stringify({ username: 'zapadmin', role: 'master', companyId: 'default' }));
    localStorage.setItem('theme', 'dark');
  }, token);

  const page = await context.newPage();

  console.log('Navigating to /inbox...');
  await page.goto(`${BASE_URL}/inbox`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  await loginIfNeeded(page);

  if (page.url().includes('login')) {
    console.log('Still on login, re-attempting submit...');
    await loginIfNeeded(page);
    await page.waitForTimeout(3000);
  }

  // Navigate explicitly to /inbox if on dashboard
  if (!page.url().includes('/inbox')) {
    await page.goto(`${BASE_URL}/inbox`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
  }

  console.log('Current URL:', page.url());

  // Wait for conversation list to load
  await page.waitForSelector('input[placeholder*="Buscar"], [role="button"], div.cursor-pointer', { timeout: 15000 }).catch(() => {});

  // Click on the first conversation to open it if not already opened
  const firstConv = page.locator('div[role="button"], div.cursor-pointer').filter({ hasText: /64630768574556|Sueli|Conversa/i }).first();
  if (await firstConv.isVisible()) {
    console.log('Selecting matched conversation...');
    await firstConv.click();
    await page.waitForTimeout(2000);
  } else {
    const anyConv = page.locator('[data-testid="conversation-item"], div.cursor-pointer').first();
    if (await anyConv.isVisible()) {
      console.log('Selecting first conversation...');
      await anyConv.click();
      await page.waitForTimeout(2000);
    }
  }

  // Ensure right sidebar is open
  const sidebarTabs = page.locator('[role="tablist"]').first();
  await sidebarTabs.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});

  const inbox1440Path = path.join(ARTIFACTS_DIR, 'FINAL_INBOX_SQUARE_TABS_1440x900.png');
  await page.screenshot({ path: inbox1440Path, fullPage: false });
  console.log('Captured:', inbox1440Path);

  // Zoom in on Detalhes da conversa and the 4 square tabs
  const detailsPanel = page.locator('aside, div').filter({ hasText: 'Detalhes da conversa' }).first();
  if (await detailsPanel.isVisible()) {
    const tabsZoomPath = path.join(ARTIFACTS_DIR, 'FINAL_INBOX_TABS_ZOOM.png');
    await detailsPanel.screenshot({ path: tabsZoomPath });
    console.log('Captured zoom:', tabsZoomPath);
  }

  // 2. Mobile 390x844
  console.log('Capturing mobile view (390x844)...');
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    ignoreHTTPSErrors: true,
  });

  await mobileContext.addInitScript((jwt) => {
    const sessionObj = {
      token: jwt,
      username: 'zapadmin',
      role: 'master',
      tenantId: 'default',
      companyId: 'default',
      issuedAt: Date.now(),
      expiresAt: Date.now() + 86400000 * 7,
      remember: true,
    };
    localStorage.setItem('zapai_admin_auth_session', JSON.stringify(sessionObj));
    sessionStorage.setItem('zapai_admin_auth_session', JSON.stringify(sessionObj));
    localStorage.setItem('auth_token', jwt);
    localStorage.setItem('token', jwt);
    localStorage.setItem('auth_user', JSON.stringify({ username: 'zapadmin', role: 'master', companyId: 'default' }));
    localStorage.setItem('theme', 'dark');
  }, token);

  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(`${BASE_URL}/inbox`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await mobilePage.waitForTimeout(3000);
  await loginIfNeeded(mobilePage);

  if (!mobilePage.url().includes('/inbox')) {
    await mobilePage.goto(`${BASE_URL}/inbox`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await mobilePage.waitForTimeout(3000);
  }

  // Click conversation to open chat
  const convItem = mobilePage.locator('div[role="button"], div.cursor-pointer').filter({ hasText: /64630768574556|Sueli|Conversa/i }).first();
  if (await convItem.isVisible()) {
    await convItem.click();
    await mobilePage.waitForTimeout(2000);
  } else {
    const anyC = mobilePage.locator('[data-testid="conversation-item"], div.cursor-pointer').first();
    if (await anyC.isVisible()) {
      await anyC.click();
      await mobilePage.waitForTimeout(2000);
    }
  }

  // Click Painel button in chat header to open drawer
  const painelBtn = mobilePage.locator('button').filter({ hasText: /Painel|Detalhes/i }).first();
  if (await painelBtn.isVisible()) {
    console.log('Clicking Painel button on mobile...');
    await painelBtn.click();
    await mobilePage.waitForTimeout(2000);
  }

  const mobileDrawerPath = path.join(ARTIFACTS_DIR, 'FINAL_INBOX_MOBILE_SQUARE_TABS_390x844.png');
  await mobilePage.screenshot({ path: mobileDrawerPath, fullPage: false });
  console.log('Captured mobile drawer:', mobileDrawerPath);

  await browser.close();
  console.log('All captures completed successfully!');
}

main().catch((err) => {
  console.error('Capture failed:', err);
  process.exit(1);
});
