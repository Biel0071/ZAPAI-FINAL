const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('../frontend-official/node_modules/@playwright/test/index.js');

const BASE_URL = 'http://209.50.241.22';
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
  console.log('Starting Playwright browser for ZAI Design System & Brain Graph captures...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'],
  });

  const token = generateAdminToken();

  // 1. DESKTOP 1440x900 CONTEXT
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

  // A. CAPTURE TOP ATTENDANTS CAROUSEL ON 1440x900
  console.log('Navigating to /attendants (1440x900)...');
  await page.goto(`${BASE_URL}/attendants`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);
  await loginIfNeeded(page);
  await page.waitForTimeout(3000);

  const carouselPath = path.join(ARTIFACTS_DIR, 'FINAL_ATTENDANTS_CAROUSEL_1440x900.png');
  await page.screenshot({ path: carouselPath, fullPage: false });
  console.log(`Saved: ${carouselPath}`);

  // Click on João (example attendant) to show visual callout banner
  const joaoCard = page.locator('button, div').filter({ hasText: 'João' }).first();
  if (await joaoCard.isVisible()) {
    console.log('Clicking example attendant João...');
    await joaoCard.click();
    await page.waitForTimeout(1500);
    const exampleSelectedPath = path.join(ARTIFACTS_DIR, 'FINAL_ATTENDANT_EXAMPLE_SELECTED_1440x900.png');
    await page.screenshot({ path: exampleSelectedPath, fullPage: false });
    console.log(`Saved: ${exampleSelectedPath}`);
  }

  // B. CAPTURE ACTIVE BRAIN GRAPH ON 1440x900
  console.log('Navigating to /ai?tab=evolution (1440x900)...');
  await page.goto(`${BASE_URL}/ai?tab=evolution`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);
  await loginIfNeeded(page);
  await page.waitForTimeout(3000);

  const graphPath = path.join(ARTIFACTS_DIR, 'FINAL_ACTIVE_BRAIN_GRAPH_1440x900.png');
  await page.screenshot({ path: graphPath, fullPage: false });
  console.log(`Saved: ${graphPath}`);

  // C. CLICK ON A MEMORY NODE TO OPEN DETAIL DRAWER
  console.log('Selecting a memory node to trigger MemoryDetailDrawer...');
  // Find a memory node element in the SVG graph or click on the first memory node
  const memoryNode = page.locator('g.cursor-pointer, text:has-text("PIX"), text:has-text("Frete")').first();
  if (await memoryNode.isVisible()) {
    await memoryNode.click();
    await page.waitForTimeout(1500);
  } else {
    // Alternatively click on list subtab and open drawer
    const listBtn = page.locator('button:has-text("Memórias Relevantes")').first();
    if (await listBtn.isVisible()) {
      await listBtn.click();
      await page.waitForTimeout(1500);
    }
  }

  const drawerPath = path.join(ARTIFACTS_DIR, 'FINAL_MEMORY_DRAWER_1440x900.png');
  await page.screenshot({ path: drawerPath, fullPage: false });
  console.log(`Saved: ${drawerPath}`);

  await desktopContext.close();

  // 2. NOTEBOOK 1366x768 CONTEXT
  const notebookContext = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    ignoreHTTPSErrors: true,
  });
  const pageNb = await notebookContext.newPage();
  await pageNb.addInitScript(({ token }) => {
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

  console.log('Navigating to /attendants (1366x768)...');
  await pageNb.goto(`${BASE_URL}/attendants`, { waitUntil: 'networkidle' });
  await pageNb.waitForTimeout(3500);

  const nbPath = path.join(ARTIFACTS_DIR, 'FINAL_ATTENDANTS_1366x768.png');
  await pageNb.screenshot({ path: nbPath, fullPage: false });
  console.log(`Saved: ${nbPath}`);

  await notebookContext.close();

  // 3. NOTEBOOK COMPACT 1280x720 CONTEXT
  const laptopContext = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  });
  const pageLaptop = await laptopContext.newPage();
  await pageLaptop.addInitScript(({ token }) => {
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

  console.log('Navigating to /attendants (1280x720)...');
  await pageLaptop.goto(`${BASE_URL}/attendants`, { waitUntil: 'networkidle' });
  await pageLaptop.waitForTimeout(3500);

  const lapPath = path.join(ARTIFACTS_DIR, 'FINAL_ATTENDANTS_1280x720.png');
  await pageLaptop.screenshot({ path: lapPath, fullPage: false });
  console.log(`Saved: ${lapPath}`);

  await laptopContext.close();

  // 4. TABLET 1024x768 CONTEXT
  const tabletContext = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    ignoreHTTPSErrors: true,
  });
  const pageTab = await tabletContext.newPage();
  await pageTab.addInitScript(({ token }) => {
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

  console.log('Navigating to /attendants (1024x768)...');
  await pageTab.goto(`${BASE_URL}/attendants`, { waitUntil: 'networkidle' });
  await pageTab.waitForTimeout(3500);

  const tabPath = path.join(ARTIFACTS_DIR, 'FINAL_ATTENDANTS_1024x768.png');
  await pageTab.screenshot({ path: tabPath, fullPage: false });
  console.log(`Saved: ${tabPath}`);

  await tabletContext.close();

  // 5. MOBILE 390x844 CONTEXT
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    ignoreHTTPSErrors: true,
  });
  const pageMob = await mobileContext.newPage();
  await pageMob.addInitScript(({ token }) => {
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

  console.log('Navigating to /attendants (390x844 Mobile)...');
  await pageMob.goto(`${BASE_URL}/attendants`, { waitUntil: 'networkidle' });
  await pageMob.waitForTimeout(3500);

  const mobPath = path.join(ARTIFACTS_DIR, 'FINAL_ATTENDANTS_MOBILE_390x844.png');
  await pageMob.screenshot({ path: mobPath, fullPage: false });
  console.log(`Saved: ${mobPath}`);

  await mobileContext.close();

  await browser.close();
  console.log('All screenshots captured successfully!');
}

main().catch((err) => {
  console.error('Capture failed:', err);
  process.exit(1);
});
