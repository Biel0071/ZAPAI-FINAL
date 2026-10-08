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

async function main() {
  console.log('Launching browser to capture Campaigns page with scheduled campaign...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'],
  });

  const token = generateAdminToken();

  // Desktop 1440x900
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();
  page.setDefaultTimeout(30000);

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

  console.log(`Navigating to ${BASE_URL}/campaigns...`);
  await page.goto(`${BASE_URL}/campaigns`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // If login form is shown, log in
  if (page.url().includes('login') || (await page.locator('input[type="password"]').count()) > 0) {
    console.log('Authenticating via login form...');
    const userInput = page.locator('input[type="text"], input[name="username"]').first();
    if (await userInput.isVisible()) await userInput.fill(USERNAME);
    const pwInput = page.locator('input[type="password"]').first();
    if (await pwInput.isVisible()) await pwInput.fill(PASSWORD);
    const submitBtn = page.locator('button[type="submit"], button:has-text("Entrar")').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await page.waitForTimeout(3000);
    }
    await page.goto(`${BASE_URL}/campaigns`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
  }

  console.log('Clicking on "Histórico" tab to show scheduled and past campaigns...');
  const histTab = page.locator('button').filter({ hasText: /Histórico/i }).first();
  if (await histTab.isVisible()) {
    await histTab.click();
    await page.waitForTimeout(2000);
  }

  // Screenshot 1: Desktop Campaigns View showing the Scheduled Campaign card
  const path1 = path.join(ARTIFACTS_DIR, 'EVIDENCE_CAMPAIGN_SCHEDULED_CHURRASQUEIRA_DESKTOP.png');
  await page.screenshot({ path: path1, fullPage: false });
  console.log(`Saved: ${path1}`);

  // Let's also zoom into the scheduled campaign card
  const campCard = page.locator('div, section').filter({ hasText: /Reativação de Anúncios|cmp-anuncio-churras/i }).first();
  if (await campCard.isVisible()) {
    await campCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    const path2 = path.join(ARTIFACTS_DIR, 'EVIDENCE_CAMPAIGN_CARD_SCHEDULED_ZOOM.png');
    await campCard.screenshot({ path: path2 });
    console.log(`Saved: ${path2}`);
  }

  await context.close();
  await browser.close();
  console.log('Campaign verification screenshots captured successfully!');
}

main().catch((err) => {
  console.error('Error in campaign verification:', err);
  process.exit(1);
});
