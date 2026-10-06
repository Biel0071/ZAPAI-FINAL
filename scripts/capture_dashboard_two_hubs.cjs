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
  console.log('Launching browser to capture Dashboard 2 Grand Hubs visual verification...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'],
  });

  const token = generateAdminToken();

  // Desktop context
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });

  const page = await desktopContext.newPage();
  page.setDefaultTimeout(30000);
  page.setDefaultNavigationTimeout(45000);

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
  }, { token });

  // 1. HUB 1 DESKTOP: Hub ZAI & Performance Comercial
  try {
    console.log('Navigating to /dashboard (Hub 1)...');
    await page.goto(`${BASE_URL}/dashboard?tab=overview`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);
    await loginIfNeeded(page);
    await page.waitForTimeout(3000);

    const hub1DesktopPath = path.join(ARTIFACTS_DIR, 'screenshot_dashboard_hub1_desktop.png');
    await page.screenshot({ path: hub1DesktopPath, fullPage: false });
    console.log(`Saved: ${hub1DesktopPath}`);
  } catch (err) {
    console.error('Error capturing Hub 1 Desktop:', err.message);
  }

  // 2. HUB 2 DESKTOP: Mapa & Inteligência de Conversas
  try {
    console.log('Navigating to /dashboard?tab=map (Hub 2)...');
    await page.goto(`${BASE_URL}/dashboard?tab=map`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    await loginIfNeeded(page);
    await page.waitForTimeout(3000);

    const hub2DesktopPath = path.join(ARTIFACTS_DIR, 'screenshot_dashboard_hub2_desktop.png');
    await page.screenshot({ path: hub2DesktopPath, fullPage: false });
    console.log(`Saved: ${hub2DesktopPath}`);

    // Click on "Leads na Região" tab in lateral panel
    const leadsTabBtn = page.locator('button[role="tab"]').filter({ hasText: /Leads na Região/i }).first();
    if (await leadsTabBtn.isVisible()) {
      console.log('Clicking Leads na Região tab in lateral panel...');
      await leadsTabBtn.click();
      await page.waitForTimeout(1500);
      const hub2LeadsTabPath = path.join(ARTIFACTS_DIR, 'screenshot_dashboard_hub2_leads_panel.png');
      await page.screenshot({ path: hub2LeadsTabPath, fullPage: false });
      console.log(`Saved: ${hub2LeadsTabPath}`);
    }
  } catch (err) {
    console.error('Error capturing Hub 2 Desktop:', err.message);
  }

  await desktopContext.close();

  // Mobile Context (390x844)
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    ignoreHTTPSErrors: true,
  });

  const mobilePage = await mobileContext.newPage();
  mobilePage.setDefaultTimeout(30000);
  mobilePage.setDefaultNavigationTimeout(45000);

  await mobilePage.addInitScript(({ token }) => {
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
  }, { token });

  // 3. HUB 1 MOBILE
  try {
    console.log('Navigating to Mobile /dashboard (Hub 1)...');
    await mobilePage.goto(`${BASE_URL}/dashboard?tab=overview`, { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForTimeout(3500);
    await loginIfNeeded(mobilePage);
    await mobilePage.waitForTimeout(2500);

    const hub1MobilePath = path.join(ARTIFACTS_DIR, 'screenshot_dashboard_hub1_mobile.png');
    await mobilePage.screenshot({ path: hub1MobilePath, fullPage: false });
    console.log(`Saved: ${hub1MobilePath}`);
  } catch (err) {
    console.error('Error capturing Hub 1 Mobile:', err.message);
  }

  // 4. HUB 2 MOBILE
  try {
    console.log('Navigating to Mobile /dashboard?tab=map (Hub 2)...');
    await mobilePage.goto(`${BASE_URL}/dashboard?tab=map`, { waitUntil: 'domcontentloaded' });
    await mobilePage.waitForTimeout(4000);
    await loginIfNeeded(mobilePage);
    await mobilePage.waitForTimeout(2500);

    const hub2MobilePath = path.join(ARTIFACTS_DIR, 'screenshot_dashboard_hub2_mobile.png');
    await mobilePage.screenshot({ path: hub2MobilePath, fullPage: false });
    console.log(`Saved: ${hub2MobilePath}`);
  } catch (err) {
    console.error('Error capturing Hub 2 Mobile:', err.message);
  }

  await mobileContext.close();
  await browser.close();
  console.log('Dashboard Two Hubs visual capture completed successfully!');
}

main().catch((err) => {
  console.error('Capture error:', err);
  process.exit(1);
});
