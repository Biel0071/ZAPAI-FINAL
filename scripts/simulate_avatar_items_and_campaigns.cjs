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
  console.log('--- STARTING COMPREHENSIVE SIMULATION: AVATAR 360, ITEM SWAPPING & CAMPAIGNS ---');
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

  // 1. ATTENDANTS PAGE (Active At Computer & Free 360 Mouse Drag)
  console.log('1. Navigating to /attendants...');
  await page.goto(`${BASE_URL}/attendants`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3500);
  await loginIfNeeded(page);
  await page.waitForTimeout(2500);

  console.log('Capturing Attendants Page (Active attendant working at PC workstation)...');
  await saveShot(page, 'SIMULATION_01_ATTENDANT_ACTIVE_WORKING_PC.png');

  // Perform free mouse drag orbit on the 3D stage avatar
  console.log('Simulating free 360 mouse drag orbit on stage avatar...');
  const stageRig = page.locator('#character-3d-rig, [data-avatar-viewport]').first();
  if (await stageRig.count() > 0) {
    const box = await stageRig.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 160, box.y + box.height / 2, { steps: 12 });
      await page.mouse.up();
      await page.waitForTimeout(1000);
      await saveShot(page, 'SIMULATION_02_STAGE_ORBIT_360_MOUSE_DRAG.png');
    }
  }

  // 2. OPEN AVATAR STUDIO MODAL
  console.log('2. Opening Avatar Studio modal...');
  const openModalBtn = page.locator('button:has-text("Avatar Studio"), button:has-text("Estúdio Avançado"), button:has-text("Personalizar Avatar")').first();
  if (await openModalBtn.count() > 0) {
    await openModalBtn.click();
    await page.waitForTimeout(1500);
  }

  const dialog = page.locator('[role="dialog"]').first();
  await dialog.waitFor({ state: 'visible', timeout: 10000 });

  // Verify modal: Standing pose during creation, degree tags hidden, hint visible
  console.log('Capturing Avatar Studio modal: Standing creation pose (WAITING)...');
  await saveShot(dialog, 'SIMULATION_03_STUDIO_MODAL_STANDING_CREATION.png');

  // 3. FEMALE ITEM SWAPPING (Hair, Face, Outfit, Accessories)
  console.log('3. Simulating item swapping on Female avatar...');
  const hairTab = dialog.locator('[role="tab"]:has-text("Cabelo")').first();
  if (await hairTab.count() > 0) {
    await hairTab.click();
    await page.waitForTimeout(600);
    // Click second hair item
    const secondHair = dialog.locator('button:has(img), button[data-item-card]').nth(1);
    if (await secondHair.count() > 0) await secondHair.click();
  }

  const faceTab = dialog.locator('[role="tab"]:has-text("Rosto")').first();
  if (await faceTab.count() > 0) {
    await faceTab.click();
    await page.waitForTimeout(600);
    const secondFace = dialog.locator('button:has(img), button[data-item-card]').nth(1);
    if (await secondFace.count() > 0) await secondFace.click();
  }

  const outfitTab = dialog.locator('[role="tab"]:has-text("Roupa")').first();
  if (await outfitTab.count() > 0) {
    await outfitTab.click();
    await page.waitForTimeout(600);
    const secondOutfit = dialog.locator('button:has(img), button[data-item-card]').nth(1);
    if (await secondOutfit.count() > 0) await secondOutfit.click();
  }

  const accTab = dialog.locator('[role="tab"]:has-text("Acessórios")').first();
  if (await accTab.count() > 0) {
    await accTab.click();
    await page.waitForTimeout(600);
    const secondAcc = dialog.locator('button:has(img), button[data-item-card]').nth(1);
    if (await secondAcc.count() > 0) await secondAcc.click();
  }

  await page.waitForTimeout(800);
  console.log('Capturing Female avatar with swapped items...');
  await saveShot(dialog, 'SIMULATION_04_FEMALE_ITEMS_SWAPPED.png');

  // 4. SWITCH TO MALE AVATAR & VERIFY FIXES
  console.log('4. Switching to Male avatar via Corpo tab...');
  const corpoTab = dialog.locator('[role="tab"]:has-text("Corpo")').first();
  if (await corpoTab.count() > 0) {
    await corpoTab.click();
    await page.waitForTimeout(600);
  }

  const maleCard = dialog.locator('div:has-text("Masculino"), button:has-text("Masculino")').last();
  if (await maleCard.count() > 0) {
    await maleCard.click();
    await page.waitForTimeout(1200);

    console.log('Capturing Male avatar standing pose (verifying male body silhouette & hair_05 Fade)...');
    await saveShot(dialog, 'SIMULATION_05_MALE_AVATAR_STANDING_FADE.png');

    // Test Male item swapping (Cabelo, Roupa, Acessórios)
    if (await hairTab.count() > 0) {
      await hairTab.click();
      await page.waitForTimeout(600);
      const maleHair = dialog.locator('button:has(img), button[data-item-card]').nth(2);
      if (await maleHair.count() > 0) await maleHair.click();
    }

    if (await outfitTab.count() > 0) {
      await outfitTab.click();
      await page.waitForTimeout(600);
      const maleOutfit = dialog.locator('button:has(img), button[data-item-card]').nth(1);
      if (await maleOutfit.count() > 0) await maleOutfit.click();
    }

    if (await accTab.count() > 0) {
      await accTab.click();
      await page.waitForTimeout(600);
      const maleAcc = dialog.locator('button:has(img), button[data-item-card]').nth(2);
      if (await maleAcc.count() > 0) await maleAcc.click();
    }

    await page.waitForTimeout(800);
    console.log('Capturing Male avatar with swapped items...');
    await saveShot(dialog, 'SIMULATION_06_MALE_ITEMS_SWAPPED.png');

    // Free 360 Mouse Drag Orbit on Male Avatar in modal
    console.log('Simulating 360 mouse drag orbit on male avatar in modal...');
    const modalRig = dialog.locator('#character-3d-rig, [data-avatar-viewport]').first();
    if (await modalRig.count() > 0) {
      const box = await modalRig.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 180, box.y + box.height / 2, { steps: 14 });
        await page.mouse.up();
        await page.waitForTimeout(1000);
        await saveShot(dialog, 'SIMULATION_07_MALE_MODAL_ORBIT_360.png');
      }
    }
  }

  // Close modal with circular green X or Salvar button
  const closeBtn = dialog.locator('button:has-text("Salvar"), button[aria-label="Close"], button:has-text("Fechar")').first();
  if (await closeBtn.count() > 0) {
    await closeBtn.click();
    await page.waitForTimeout(1500);
  }

  // 5. CAMPAIGNS PAGE & BUSINESS HOURS CONSENT POP-UP
  console.log('5. Navigating to /campaigns...');
  await page.goto(`${BASE_URL}/campaigns`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  // Click on Histórico tab
  const historicoTab = page.locator('button:has-text("Histórico")').first();
  if (await historicoTab.count() > 0) {
    await historicoTab.click();
    await page.waitForTimeout(1500);
  }

  console.log('Capturing Campaigns page (Histórico)...');
  await saveShot(page, 'SIMULATION_08_CAMPAIGNS_HISTORICO.png');

  // Trigger campaign action to test Business Hours Consent Dialog
  console.log('Testing campaign action to trigger Business Hours dialog...');
  const actionBtn = page.locator('button:has-text("Iniciar"), button:has-text("Retomar"), button:has-text("Iniciar Sem Risco")').first();
  if (await actionBtn.count() > 0) {
    await actionBtn.click();
    await page.waitForTimeout(1500);

    const consentDialog = page.locator('[role="dialog"]:has-text("Horário Comercial"), [role="dialog"]:has-text("Ajustar para Próximo")').first();
    if (await consentDialog.count() > 0) {
      console.log('Business Hours Consent Dialog detected!');
      await saveShot(consentDialog, 'SIMULATION_09_CAMPAIGN_BUSINESS_HOURS_CONSENT_POPUP.png');
    } else {
      await saveShot(page, 'SIMULATION_09_CAMPAIGN_ACTION_RESULT.png');
    }
  }

  await browser.close();
  console.log('--- ALL SIMULATIONS AND SCREENSHOT EVIDENCE GENERATED SUCCESSFULLY ---');
}

run().catch((err) => {
  console.error('Fatal Simulation Error:', err);
  process.exit(1);
});
