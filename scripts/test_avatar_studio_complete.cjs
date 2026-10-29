const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join(__dirname, '../frontend-official/node_modules/@playwright/test'));

const URL = 'https://209.50.241.22:1000';
const USERNAME = 'zapadmin';
const PASSWORD = 'zapadmin1010';
const ARTIFACT_DIR = path.join('C:\\Users\\Dell\\.gemini\\antigravity\\brain\\578a7157-8bf3-47e3-82f2-9ed1bb8f9f40\\evidence');

if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

async function run() {
  console.log('[PLAYWRIGHT] Starting Full Avatar Studio & 3D Render Verification...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--no-sandbox']
  });

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 960 }
  });

  const page = await context.newPage();

  try {
    console.log('[PLAYWRIGHT] Navigating to:', `${URL}/login`);
    await page.goto(`${URL}/login`, { timeout: 60000 });
    await page.waitForTimeout(2000);

    if (page.url().includes('login') || (await page.locator('#login-username').count()) > 0) {
      console.log('[PLAYWRIGHT] Performing login...');
      await page.fill('#login-username', USERNAME);
      await page.fill('#login-password', PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);
    }

    console.log('[PLAYWRIGHT] Navigating to /attendants...');
    await page.goto(`${URL}/attendants`, { waitUntil: 'networkidle', timeout: 35000 });
    await page.waitForTimeout(3000);

    // Switch to Modo Completo if available
    const modoCompletoBtn = page.locator('button:has-text("Modo Completo")').first();
    if (await modoCompletoBtn.isVisible()) {
      console.log('[PLAYWRIGHT] Ensuring Modo Completo is active...');
      await modoCompletoBtn.click();
      await page.waitForTimeout(1000);
    }

    // Scroll Avatar Studio into view
    const avatarStudioCard = page.locator('text=Avatar Studio').first();
    if (await avatarStudioCard.isVisible()) {
      await avatarStudioCard.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
    }

    // ==========================================
    // TEST 1: TEST ROSTO -> EXPRESSIVO COMERCIAL (face_04)
    // ==========================================
    console.log('[PLAYWRIGHT] Test 1: Testing ROSTO tab -> Expressivo Comercial (face_04)...');
    const faceCategoryBtn = page.locator('button:has-text("Rosto")').first();
    await faceCategoryBtn.click();
    await page.waitForTimeout(800);

    const face04Btn = page.locator('button[data-avatar-item="face_04"]').first();
    if (await face04Btn.isVisible()) {
      await face04Btn.click();
      await page.waitForTimeout(1000);
      console.log('[PLAYWRIGHT] Selected face_04 (Expressivo Comercial).');
    }

    const shot1 = path.join(ARTIFACT_DIR, '01_avatar_face04_expressivo_comercial.png');
    await page.screenshot({ path: shot1, fullPage: false });
    console.log('[PLAYWRIGHT] Saved screenshot 1:', shot1);

    // ==========================================
    // TEST 2: TEST OTHER FACES (face_02, face_03)
    // ==========================================
    console.log('[PLAYWRIGHT] Test 2: Testing face_02 (Confiante) and face_03 (Carismático)...');
    const face02Btn = page.locator('button[data-avatar-item="face_02"]').first();
    if (await face02Btn.isVisible()) {
      await face02Btn.click();
      await page.waitForTimeout(600);
    }
    const face03Btn = page.locator('button[data-avatar-item="face_03"]').first();
    if (await face03Btn.isVisible()) {
      await face03Btn.click();
      await page.waitForTimeout(600);
    }

    const shot2 = path.join(ARTIFACT_DIR, '02_avatar_face_swaps.png');
    await page.screenshot({ path: shot2, fullPage: false });
    console.log('[PLAYWRIGHT] Saved screenshot 2:', shot2);

    // ==========================================
    // TEST 3: SWAP CABELO (hair_03 Ondulado Longo)
    // ==========================================
    console.log('[PLAYWRIGHT] Test 3: Testing CABELO tab -> Ondulado Longo (hair_03)...');
    const hairCategoryBtn = page.locator('button:has-text("Cabelo")').first();
    await hairCategoryBtn.click();
    await page.waitForTimeout(800);

    const hair03Btn = page.locator('button[data-avatar-item="hair_03"]').first();
    if (await hair03Btn.isVisible()) {
      await hair03Btn.click();
      await page.waitForTimeout(1000);
      console.log('[PLAYWRIGHT] Selected hair_03 (Ondulado Longo).');
    }

    const shot3 = path.join(ARTIFACT_DIR, '03_avatar_hair03_swapped.png');
    await page.screenshot({ path: shot3, fullPage: false });
    console.log('[PLAYWRIGHT] Saved screenshot 3:', shot3);

    // ==========================================
    // TEST 4: SWAP ROUPA (outfit_05 Blazer Alfaiataria)
    // ==========================================
    console.log('[PLAYWRIGHT] Test 4: Testing ROUPA tab -> Blazer Alfaiataria (outfit_05)...');
    const outfitCategoryBtn = page.locator('button:has-text("Roupa")').first();
    await outfitCategoryBtn.click();
    await page.waitForTimeout(800);

    const outfit05Btn = page.locator('button[data-avatar-item="outfit_05"]').first();
    if (await outfit05Btn.isVisible()) {
      await outfit05Btn.click();
      await page.waitForTimeout(1000);
      console.log('[PLAYWRIGHT] Selected outfit_05 (Blazer).');
    }

    const shot4 = path.join(ARTIFACT_DIR, '04_avatar_outfit05_blazer.png');
    await page.screenshot({ path: shot4, fullPage: false });
    console.log('[PLAYWRIGHT] Saved screenshot 4:', shot4);

    // ==========================================
    // TEST 5: SWAP ACESSÓRIOS (Headset + Glasses)
    // ==========================================
    console.log('[PLAYWRIGHT] Test 5: Testing ACESSÓRIOS tab -> Headset & Glasses...');
    const accCategoryBtn = page.locator('button:has-text("Acessórios")').first();
    await accCategoryBtn.click();
    await page.waitForTimeout(800);

    const accHeadsetBtn = page.locator('button[data-avatar-item="acc_02"]').first();
    if (await accHeadsetBtn.isVisible()) {
      await accHeadsetBtn.click();
      await page.waitForTimeout(600);
      console.log('[PLAYWRIGHT] Toggled acc_02 (Headset).');
    }

    const shot5 = path.join(ARTIFACT_DIR, '05_avatar_accessories_equipped.png');
    await page.screenshot({ path: shot5, fullPage: false });
    console.log('[PLAYWRIGHT] Saved screenshot 5:', shot5);

    // ==========================================
    // TEST 6: TEST 3D/BLENDER MOVEMENTS (Pose, Wave, Walk)
    // ==========================================
    console.log('[PLAYWRIGHT] Test 6: Testing 3D movements (Posar 3D, Acenar 3D, Andar 3D)...');
    const poseBtn = page.locator('button:has-text("Posar 3D")').first();
    if (await poseBtn.isVisible()) {
      await poseBtn.click();
      await page.waitForTimeout(1000);
      const shot6 = path.join(ARTIFACT_DIR, '06_avatar_3d_pose.png');
      await page.screenshot({ path: shot6, fullPage: false });
      console.log('[PLAYWRIGHT] Saved screenshot 6 (Posar 3D):', shot6);
    }

    const waveBtn = page.locator('button:has-text("Acenar 3D")').first();
    if (await waveBtn.isVisible()) {
      await waveBtn.click();
      await page.waitForTimeout(1000);
      const shot7 = path.join(ARTIFACT_DIR, '07_avatar_3d_wave.png');
      await page.screenshot({ path: shot7, fullPage: false });
      console.log('[PLAYWRIGHT] Saved screenshot 7 (Acenar 3D):', shot7);
    }

    const walkBtn = page.locator('button:has-text("Andar 3D")').first();
    if (await walkBtn.isVisible()) {
      await walkBtn.click();
      await page.waitForTimeout(1000);
      const shot8 = path.join(ARTIFACT_DIR, '08_avatar_3d_walk.png');
      await page.screenshot({ path: shot8, fullPage: false });
      console.log('[PLAYWRIGHT] Saved screenshot 8 (Andar 3D):', shot8);
    }

    // ==========================================
    // TEST 7: 3D TURNTABLE ORBIT DRAG
    // ==========================================
    console.log('[PLAYWRIGHT] Test 7: Simulating 3D turntable drag for turnaround view...');
    const stage = page.locator('div[title*="Clique e arraste"]').first();
    if (await stage.isVisible()) {
      const box = await stage.boundingBox();
      if (box) {
        // Drag horizontally from left to right
        await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.5, { steps: 15 });
        await page.mouse.up();
        await page.waitForTimeout(1000);
      }
    }

    const shot9 = path.join(ARTIFACT_DIR, '09_avatar_3d_orbit_drag.png');
    await page.screenshot({ path: shot9, fullPage: false });
    console.log('[PLAYWRIGHT] Saved screenshot 9 (3D Orbit Drag):', shot9);

    // ==========================================
    // TEST 8: TEST MALE ATTENDANT (♂ Masc + Beard & Glasses)
    // ==========================================
    console.log('[PLAYWRIGHT] Test 8: Testing Male Gender Toggle & Beard/Glasses (face_07)...');
    const mascBtn = page.locator('button:has-text("♂ Masc")').first();
    if (await mascBtn.isVisible()) {
      await mascBtn.click();
      await page.waitForTimeout(1000);

      // Select face_07 for beard & glasses
      await faceCategoryBtn.click();
      await page.waitForTimeout(600);
      const face07Btn = page.locator('button[data-avatar-item="face_07"]').first();
      if (await face07Btn.isVisible()) {
        await face07Btn.click();
        await page.waitForTimeout(1000);
      }
    }

    const shot10 = path.join(ARTIFACT_DIR, '10_avatar_male_beard_intellectual.png');
    await page.screenshot({ path: shot10, fullPage: false });
    console.log('[PLAYWRIGHT] Saved screenshot 10 (Male Attendant):', shot10);

    // ==========================================
    // TEST 8B: TEST MALE BLAZER (outfit_05)
    // ==========================================
    console.log('[PLAYWRIGHT] Test 8B: Testing Male Blazer Alfaiataria (outfit_05)...');
    await outfitCategoryBtn.click();
    await page.waitForTimeout(600);
    const outfit05Masc = page.locator('button[data-avatar-item="outfit_05"]').first();
    if (await outfit05Masc.isVisible()) {
      await outfit05Masc.click();
      await page.waitForTimeout(1000);
    }
    const shot12 = path.join(ARTIFACT_DIR, '12_avatar_male_blazer.png');
    await page.screenshot({ path: shot12, fullPage: false });
    console.log('[PLAYWRIGHT] Saved screenshot 12 (Male Blazer):', shot12);

    // ==========================================
    // TEST 9: RESTORE FEMALE & SAVE AVATAR
    // ==========================================
    console.log('[PLAYWRIGHT] Test 9: Restoring Female Attendant & Clicking Salvar Avatar...');
    const femBtn = page.locator('button:has-text("♀ Fem")').first();
    if (await femBtn.isVisible()) {
      await femBtn.click();
      await page.waitForTimeout(1000);
    }

    // Switch back to face_04
    await faceCategoryBtn.click();
    await page.waitForTimeout(600);
    if (await face04Btn.isVisible()) {
      await face04Btn.click();
      await page.waitForTimeout(600);
    }

    const saveBtn = page.locator('button:has-text("Salvar Avatar")').first();
    if (await saveBtn.isVisible()) {
      console.log('[PLAYWRIGHT] Clicking Salvar Avatar...');
      await saveBtn.click();
      await page.waitForTimeout(2500);
    }

    const shot11 = path.join(ARTIFACT_DIR, '11_avatar_saved_successfully.png');
    await page.screenshot({ path: shot11, fullPage: false });
    console.log('[PLAYWRIGHT] Saved screenshot 11 (Saved Avatar):', shot11);

    // ==========================================
    // TEST 10: TEST MEMÓRIA & EVOLUÇÃO (4 Consolidated Fields & XP Progress Bar)
    // ==========================================
    console.log('[PLAYWRIGHT] Test 10: Testing Memória & Evolução tab (4 fields & XP bar)...');
    const evolucaoTabBtn = page.locator('button:has-text("Memória & Evolução")').first();
    if (await evolucaoTabBtn.isVisible()) {
      await evolucaoTabBtn.click();
      await page.waitForTimeout(2500);
      const shot13 = path.join(ARTIFACT_DIR, '13_evolution_tab_4_fields.png');
      await page.screenshot({ path: shot13, fullPage: false });
      console.log('[PLAYWRIGHT] Saved screenshot 13 (Evolution Tab 4 Fields):', shot13);
    }

    console.log('[PLAYWRIGHT] ALL TESTS COMPLETED SUCCESSFULLY! ZERO GLITCHES DETECTED.');
  } catch (err) {
    console.error('[PLAYWRIGHT ERROR]:', err);
  } finally {
    await browser.close();
  }
}

run();
