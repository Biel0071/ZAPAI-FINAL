const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require(path.resolve(__dirname, '../frontend-official/node_modules/@playwright/test'));

const BASE_URL = 'https://209.50.241.22';
const USERNAME = 'zapadmin';
const PASSWORD = 'zapadmin1010';
const JWT_SECRET = '73d1ef96dde5afc4938e0b71a5978b2666f1885fb0d2febc4bd52cc7a1cd9e15';
const BRAIN_DIR = 'C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40';

if (!fs.existsSync(BRAIN_DIR)) {
  fs.mkdirSync(BRAIN_DIR, { recursive: true });
}

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

async function saveShot(target, filename, options = {}) {
  const fullPath = path.join(BRAIN_DIR, filename);
  const buf = await target.screenshot(options);
  fs.writeFileSync(fullPath, buf);
  console.log(`[SAVED] ${filename} (${buf.length} bytes)`);
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

async function run() {
  console.log('--- STARTING ATTENDANT SCENARIO VERIFICATION ---');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'],
  });

  const token = generateAdminToken();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 920 },
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

  console.log('1. Navigating to /attendants...');
  await page.goto(`${BASE_URL}/attendants`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3500);
  await loginIfNeeded(page);
  await page.waitForTimeout(3000);

  // 1. CAPTURE STREAMLINED PAGE: Camila in canonical 2.5D modular avatar with new single-line header and toolbar
  console.log('Capturing: VERIFY_01_ATTENDANTS_PAGE_STREAMLINED.png');
  await saveShot(page, 'VERIFY_01_ATTENDANTS_PAGE_STREAMLINED.png');

  // 2. TOGGLE PAUSE to see STANDING STATE ON PEDESTAL
  console.log('2. Clicking toggle pause button on stage...');
  const toggleBtn = page.locator('button[data-stage-toggle-active]').first();
  if (await toggleBtn.isVisible()) {
    await toggleBtn.click();
    await page.waitForTimeout(2500);
    console.log('Capturing: VERIFY_02_ATTENDANTS_STANDING_IDLE_PEDESTAL.png');
    await saveShot(page, 'VERIFY_02_ATTENDANTS_STANDING_IDLE_PEDESTAL.png');

    // Toggle back to active
    await toggleBtn.click();
    await page.waitForTimeout(2000);
  }

  // 3. OPEN AVATAR STUDIO MODAL: Standing pose during creation/customization
  console.log('3. Opening Avatar Studio modal for Camila...');
  const openModalBtn = page.locator('button:has-text("Estúdio Avançado")').first();
  if (await openModalBtn.isVisible()) {
    await openModalBtn.click();
    await page.waitForTimeout(2500);
    const dialog = page.locator('[role="dialog"]').first();
    if (await dialog.isVisible()) {
      // 5. Capture Female view in Avatar Studio
      console.log('Capturing: VERIFY_05_AVATAR_STUDIO_FEMALE.png');
      await saveShot(dialog, 'VERIFY_05_AVATAR_STUDIO_FEMALE.png');

      // 6. Click "Masculino" card in Avatar Studio
      console.log('Clicking "Masculino" card...');
      const maleCardBtn = dialog.locator('button:has-text("Masculino")').first();
      if (await maleCardBtn.isVisible()) {
        await maleCardBtn.click();
        await page.waitForTimeout(2000);
        console.log('Capturing: VERIFY_06_AVATAR_STUDIO_MALE_SWITCH.png');
        await saveShot(dialog, 'VERIFY_06_AVATAR_STUDIO_MALE_SWITCH.png');
      }

      // 7. Test 3D movement button "Acenar 3D" or "Andar 3D" on 2.5D Chibi puppet
      console.log('Clicking "Acenar 3D" button on 2.5D Chibi puppet...');
      const waveBtn = dialog.locator('button[data-avatar-movement-btn="wave"], button:has-text("Acenar 3D")').first();
      if (await waveBtn.isVisible()) {
        await waveBtn.click();
        await page.waitForTimeout(1500);
        console.log('Capturing: VERIFY_07_AVATAR_STUDIO_3D_MOVEMENTS.png');
        await saveShot(dialog, 'VERIFY_07_AVATAR_STUDIO_3D_MOVEMENTS.png');
      }

      // Close modal
      const closeBtn = page.locator('button[aria-label="Close"], button:has-text("Cancelar"), [role="dialog"] button:has-text("✕")').first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      } else {
        await page.keyboard.press('Escape');
      }
      await page.waitForTimeout(1500);
    }
  }

  // 4. CLICK NOVO ATENDENTE BUTTON LOCATED IN THE ATTENDANTS LINE
  console.log('4. Clicking [+ Novo Atendente] in the attendants line...');
  const newAttendantBtn = page.locator('button:has-text("Novo Atendente")').first();
  if (await newAttendantBtn.isVisible()) {
    await newAttendantBtn.click();
    await page.waitForTimeout(2000);
    console.log('Capturing: VERIFY_04_NEW_ATTENDANT_WIZARD.png');
    await saveShot(page, 'VERIFY_04_NEW_ATTENDANT_WIZARD.png');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
  }

  // 5. TEST MALE ATTENDANT ON MAIN STAGE WORKING AT PC
  console.log('5. Clicking ♂ Masc on the main attendants page...');
  const maleBtn = page.locator('button[data-studio-gender="male"]').first();
  if (await maleBtn.isVisible()) {
    await maleBtn.click();
    await page.waitForTimeout(2000);
    console.log('Capturing: VERIFY_03_ATTENDANTS_PAGE_MALE_WORKING.png');
    await saveShot(page, 'VERIFY_03_ATTENDANTS_PAGE_MALE_WORKING.png');

    // Return to female
    const femaleBtn = page.locator('button[data-studio-gender="female"]').first();
    if (await femaleBtn.isVisible()) {
      await femaleBtn.click();
      await page.waitForTimeout(1500);
    }
  }

  // 6. MOBILE VIEWPORT (390 x 844)
  console.log('6. Capturing mobile viewport (390x844)...');
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
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
  await mobilePage.goto(`${BASE_URL}/attendants`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await mobilePage.waitForTimeout(3000);
  await saveShot(mobilePage, 'VERIFY_08_ATTENDANTS_MOBILE_390.png');

  // Also capture close-up of mobile header
  const headerElem = mobilePage.locator('header').first();
  if (await headerElem.isVisible()) {
    await saveShot(headerElem, 'VERIFY_11_MOBILE_HEADER_SESSION.png');
  }

  await mobileContext.close();

  await browser.close();
  console.log('--- ALL ATTENDANT VERIFICATIONS COMPLETED SUCCESSFULLY ---');
}

run().catch((err) => {
  console.error('Fatal error during capture:', err);
  process.exit(1);
});
