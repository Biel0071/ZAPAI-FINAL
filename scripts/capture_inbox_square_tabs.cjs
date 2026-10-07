const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('../frontend-official/node_modules/@playwright/test/index.js');

const BASE_URL = 'http://209.50.241.22';
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

async function main() {
  console.log('Launching browser to capture Inbox square tabs...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'],
  });

  const token = generateAdminToken();

  // Desktop 1440x900
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });

  await context.addInitScript((jwt) => {
    localStorage.setItem('auth_token', jwt);
    localStorage.setItem('token', jwt);
    localStorage.setItem('auth_user', JSON.stringify({ username: 'zapadmin', role: 'master', companyId: 'default' }));
    localStorage.setItem('theme', 'dark');
  }, token);

  const page = await context.newPage();

  console.log('Navigating to /inbox...');
  await page.goto(`${BASE_URL}/inbox`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(4000);

  // Click on the first conversation to open it if not already opened
  const firstConv = page.locator('div[role="button"]:has-text("64630768574556"), div.cursor-pointer:has-text("64630768574556")').first();
  if (await firstConv.isVisible()) {
    console.log('Selecting conversation 64630768574556...');
    await firstConv.click();
    await page.waitForTimeout(2000);
  } else {
    // Click any conversation in list
    const anyConv = page.locator('[data-testid="conversation-item"], div.cursor-pointer').first();
    if (await anyConv.isVisible()) {
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
  const detailsPanel = page.locator('aside:has-text("Detalhes da conversa"), div:has-text("Detalhes da conversa")').first();
  if (await detailsPanel.isVisible()) {
    const tabsZoomPath = path.join(ARTIFACTS_DIR, 'FINAL_INBOX_TABS_ZOOM.png');
    await detailsPanel.screenshot({ path: tabsZoomPath });
    console.log('Captured zoom:', tabsZoomPath);
  }

  await browser.close();
  console.log('All captures completed successfully!');
}

main().catch((err) => {
  console.error('Capture failed:', err);
  process.exit(1);
});
