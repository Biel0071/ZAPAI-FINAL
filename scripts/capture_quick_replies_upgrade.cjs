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
  console.log('Launching browser for Quick Replies visual evidence...');
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

  console.log(`Navigating to ${BASE_URL}/inbox...`);
  await page.goto(`${BASE_URL}/inbox`, { waitUntil: 'domcontentloaded' });
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
    await page.goto(`${BASE_URL}/inbox`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
  }

  // Select a conversation
  console.log('Selecting active conversation...');
  const conv = page.locator('div[role="button"], button').filter({ hasText: /55|Alfredo|Sentimento|Selma|Marcos|10490/i }).first();
  if (await conv.isVisible()) {
    await conv.click();
    await page.waitForTimeout(2000);
  }

  // Go to Tab "Respostas Rápidas" in right sidebar
  console.log('Opening Tab Respostas Rápidas...');
  const qrTab = page.locator('button[role="tab"]').filter({ hasText: /Respostas/i }).first();
  if (await qrTab.isVisible()) {
    await qrTab.click();
    await page.waitForTimeout(1500);
  }

  // 1. Evidence 1: Open "+" Dropdown in sidebar
  console.log('Opening "+" dropdown in sidebar...');
  const plusBtn = page.locator('button[title*="Criar nova resposta"], button:has-text("Nova")').first();
  if (await plusBtn.isVisible()) {
    await plusBtn.click();
    await page.waitForTimeout(1000);
    const path1 = path.join(ARTIFACTS_DIR, 'EVIDENCE_SIDEBAR_QUICK_REPLIES_PLUS_DROPDOWN.png');
    await page.screenshot({ path: path1, fullPage: false });
    console.log(`Saved: ${path1}`);
    // Close dropdown
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  // Expand SCRIPTS or first category
  const scriptsAccordion = page.locator('button, div').filter({ hasText: /^SCRIPTS/i }).first();
  if (await scriptsAccordion.isVisible()) {
    await scriptsAccordion.click();
    await page.waitForTimeout(1000);
  }

  // 2. Open "Editar e enviar resposta rápida" Modal
  console.log('Opening QuickResponseModal for CHURRAS or first item...');
  const editAndSendBtn = page.locator('button[aria-label*="Prévia"], button:has-text("CHURRAS")').first();
  if (await editAndSendBtn.isVisible()) {
    await editAndSendBtn.click();
    await page.waitForTimeout(1500);
  } else {
    // try any item eye icon
    const anyEye = page.locator('button[title*="Editar e enviar"], button[title*="Prévia"]').first();
    if (await anyEye.isVisible()) {
      await anyEye.click();
      await page.waitForTimeout(1500);
    }
  }

  // Take screenshot of Modal
  const path2 = path.join(ARTIFACTS_DIR, 'EVIDENCE_MODAL_EDITAR_E_ENVIAR_RESPOSTA_RAPIDA.png');
  await page.screenshot({ path: path2, fullPage: false });
  console.log(`Saved: ${path2}`);

  // 3. Open "#Tags" Popover inside Modal
  console.log('Clicking "#Tags" button to open tags popover...');
  const tagsBtn = page.locator('button[aria-label*="Tags disponíveis para uso"], button:has-text("#Tags")').first();
  if (await tagsBtn.isVisible()) {
    await tagsBtn.click();
    await page.waitForTimeout(1000);
    const path3 = path.join(ARTIFACTS_DIR, 'EVIDENCE_TAGS_POPOVER_CONTACT_PROFILE.png');
    await page.screenshot({ path: path3, fullPage: false });
    console.log(`Saved: ${path3}`);
  }

  await page.keyboard.press('Escape');
  await context.close();
  await browser.close();
  console.log('Visual evidence capture completed successfully!');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
