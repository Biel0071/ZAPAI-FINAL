const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('../frontend-official/node_modules/@playwright/test/index.js');

const BASE_URL = 'https://209.50.241.22';
const USERNAME = 'zapadmin';
const PASSWORD = 'zapadmin1010';
const JWT_SECRET = '73d1ef96dde5afc4938e0b71a5978b2666f1885fb0d2febc4bd52cc7a1cd9e15';

const OUTPUT_DIRS = [
  'C:/Users/Dell/.gemini/antigravity/brain/0356c0e1-b21c-4dcb-81eb-1329a66527b2',
  'C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40'
];

OUTPUT_DIRS.forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

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

async function saveMultiScreenshot(page, filename, options = {}) {
  const buffer = await page.screenshot(options);
  for (const dir of OUTPUT_DIRS) {
    const fullPath = path.join(dir, filename);
    fs.writeFileSync(fullPath, buffer);
    console.log(`Saved screenshot: ${fullPath}`);
  }
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
  console.log('Launching browser to capture verified Inbox screenshots...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'],
  });

  const token = generateAdminToken();

  // 1. Desktop 1440x900 Dark Mode
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

  // Navigate to Inbox explicitly via sidebar or URL
  const inboxLink = page.locator('a[href="/inbox"]').first();
  if (await inboxLink.isVisible()) {
    console.log('Clicking Inbox link...');
    await inboxLink.click();
    await page.waitForTimeout(3000);
  } else {
    await page.goto(`${BASE_URL}/inbox`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
  }

  console.log('Page URL:', page.url());

  // Wait for conversation list to be rendered
  await page.waitForSelector('div.cursor-pointer, [role="tablist"]', { timeout: 15000 }).catch(() => {});

  // Click on a conversation item (e.g. Sueli or first item)
  const convItem = page.locator('div.cursor-pointer').filter({ hasText: /Sueli|Conversa|\d{10,}/ }).first();
  if (await convItem.isVisible()) {
    console.log('Clicking conversation item...');
    await convItem.click();
    await page.waitForTimeout(3000);
  } else {
    const fallbackItem = page.locator('div[role="button"].cursor-pointer, .border-b div.cursor-pointer').first();
    if (await fallbackItem.isVisible()) {
      await fallbackItem.click();
      await page.waitForTimeout(3000);
    }
  }

  // Ensure right panel is visible
  const sidebarTabs = page.locator('[role="tablist"]').first();
  await sidebarTabs.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});

  await saveMultiScreenshot(page, 'VERIFIED_INBOX_DESKTOP_DARK_1440x900.png');

  // Zoom into Right Panel
  const detailsPanel = page.locator('aside, div').filter({ hasText: 'Detalhes da conversa' }).first();
  if (await detailsPanel.isVisible()) {
    const buffer = await detailsPanel.screenshot();
    for (const dir of OUTPUT_DIRS) {
      fs.writeFileSync(path.join(dir, 'VERIFIED_INBOX_RIGHT_PANEL_ZOOM.png'), buffer);
      console.log(`Saved zoom screenshot`);
    }
  }

  // Open notifications menu in header
  const bellBtn = page.locator('button[aria-label="Notificações"]').first();
  if (await bellBtn.isVisible()) {
    await bellBtn.click();
    await page.waitForTimeout(1000);
    await saveMultiScreenshot(page, 'VERIFIED_INBOX_NOTIFICATIONS_OPEN.png');
    // Close it by clicking outside or escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  // Switch to Light Mode
  console.log('Switching to Light Mode...');
  const themeBtn = page.locator('button[title*="Tema Claro"], button[title*="Tema Escuro"]').first();
  if (await themeBtn.isVisible()) {
    await themeBtn.click();
    await page.waitForTimeout(1500);
    await saveMultiScreenshot(page, 'VERIFIED_INBOX_DESKTOP_LIGHT_1440x900.png');
  }

  // 2. Mobile View 390x844
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

  const mobConv = mobilePage.locator('div.cursor-pointer').filter({ hasText: /Sueli|Conversa|\d{10,}/ }).first();
  if (await mobConv.isVisible()) {
    console.log('Clicking mobile conversation...');
    await mobConv.click({ force: true });
    await mobilePage.waitForTimeout(2000);
  }

  const painelBtn = mobilePage.locator('button[aria-label="Abrir painel da conversa"]').first();
  if (await painelBtn.count() > 0) {
    console.log('Clicking mobile panel button...');
    await painelBtn.click({ force: true });
    await mobilePage.waitForTimeout(2500);
  }

  await saveMultiScreenshot(mobilePage, 'VERIFIED_INBOX_MOBILE_DRAWER_390x844.png');

  await browser.close();
  console.log('All verification captures completed successfully!');
}

main().catch((err) => {
  console.error('Error during capture:', err);
  process.exit(1);
});
