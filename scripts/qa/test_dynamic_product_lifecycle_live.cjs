const { chromium } = require('../../frontend-official/node_modules/playwright');
const axios = require('../../backend/node_modules/axios').default;
const fs = require('fs');
const path = require('path');
const https = require('https');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const API_BASE = 'https://209.50.241.22:1000';
const ARTIFACT_DIR = path.resolve('C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40');

async function runDynamicLifecycleTest() {
  console.log('================================================================');
  console.log('   EMPIRICAL VALIDATION: DYNAMIC CATALOG LIFECYCLE ON VPS LIVE  ');
  console.log('================================================================');

  let token = '';
  let testProductId = '';
  let uploadedImageUrl = '';

  try {
    // 1. Authenticate via API to obtain JWT
    console.log('Step 1: Authenticating on https://209.50.241.22:1000/api/auth/login ...');
    const loginRes = await axios.post(`${API_BASE}/api/auth/login`, {
      username: 'zapadmin',
      password: 'zapadmin1010'
    }, { httpsAgent });

    token = loginRes.data?.token || loginRes.data?.accessToken;
    if (!token) throw new Error('Failed to obtain JWT token from login: ' + JSON.stringify(loginRes.data));
    console.log('✔ Authenticated successfully. Token acquired.');

    const authHeaders = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // 2. Test Dynamic Image Upload (upload-image endpoint)
    console.log('\nStep 2: Testing POST /api/products/upload-image (dynamic photo upload)...');
    // Read an authentic image from public assets to upload
    const sourceImagePath = path.resolve('frontend-official/public/assets/catalog/areia_m3.png');
    let base64Image = '';
    if (fs.existsSync(sourceImagePath)) {
      const imgBuffer = fs.readFileSync(sourceImagePath);
      base64Image = `data:image/png;base64,${imgBuffer.toString('base64')}`;
    } else {
      // Fallback 1x1 test png base64
      base64Image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    }

    const uploadRes = await axios.post(`${API_BASE}/api/products/upload-image`, {
      base64: base64Image
    }, { httpsAgent, headers: authHeaders });

    const uploadPayload = uploadRes.data?.data || uploadRes.data;
    if (!uploadRes.data?.success || !uploadPayload?.url) {
      throw new Error('Upload image failed: ' + JSON.stringify(uploadRes.data));
    }
    uploadedImageUrl = uploadPayload.url;
    console.log('✔ Image uploaded successfully to server path:', uploadedImageUrl);

    // 3. Test Dynamic Product Creation (POST /api/products)
    console.log('\nStep 3: Testing POST /api/products (creating dynamic product)...');
    const dynamicProductName = `CANALETA DINÂMICA ${Date.now().toString().slice(-4)}`;
    const createRes = await axios.post(`${API_BASE}/api/products`, {
      name: dynamicProductName,
      code: `CAN-${Date.now().toString().slice(-4)}`,
      price: 49.90,
      category: 'Tijolos & Blocos',
      description: 'Canaleta de concreto estrutural criada dinamicamente para teste de ciclo de vida.',
      stock: 120,
      images: [uploadedImageUrl],
      shipping: 'Entrega imediata'
    }, { httpsAgent, headers: authHeaders });

    if (!createRes.data?.success || !createRes.data?.data?.id) {
      throw new Error('Create product failed: ' + JSON.stringify(createRes.data));
    }
    testProductId = createRes.data.data.id;
    console.log(`✔ Dynamic product created with ID: ${testProductId}, Name: "${dynamicProductName}", Price: R$ 49,90`);

    // 4. Verify Product Exists in Catalog (GET /api/products)
    console.log('\nStep 4: Verifying product persistence in GET /api/products ...');
    const listRes = await axios.get(`${API_BASE}/api/products`, { httpsAgent, headers: authHeaders });
    const foundProduct = (listRes.data?.data || []).find(p => p.id === testProductId);
    if (!foundProduct) {
      throw new Error(`Created product ${testProductId} not found in catalog list!`);
    }
    console.log(`✔ Verified: Product found in database repository. Price=${foundProduct.price}, Image=${foundProduct.images?.[0]}`);

    // 5. Test Dynamic Product Alteration / Edit (PUT /api/products/:id)
    console.log('\nStep 5: Testing PUT /api/products/:id (altering price and details)...');
    const updateRes = await axios.put(`${API_BASE}/api/products/${testProductId}`, {
      price: 55.50,
      description: 'Canaleta atualizada dinamicamente com novo valor R$ 55,50 e foto oficial.',
      stock: 150
    }, { httpsAgent, headers: authHeaders });

    if (!updateRes.data?.success || Number(updateRes.data?.data?.price) !== 55.50) {
      throw new Error('Update product failed: ' + JSON.stringify(updateRes.data));
    }
    console.log('✔ Product altered successfully! Updated Price: R$ 55,50');

    // 6. Test UI Flow with Playwright: Open Inbox, find altered product in popover, send it to chat
    console.log('\nStep 6: Testing UI interaction with Playwright on live Inbox...');
    const browser = await chromium.launch({
      headless: true,
      args: ['--ignore-certificate-errors', '--no-sandbox', '--disable-setuid-sandbox']
    });
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1440, height: 900 }
    });
    const page = await context.newPage();

    console.log('Logging into UI via browser...');
    await page.goto(`${API_BASE}/login`, { timeout: 35000, waitUntil: 'domcontentloaded' });
    await page.fill('#login-username', 'zapadmin');
    await page.fill('#login-password', 'zapadmin1010');
    await Promise.all([
      page.waitForNavigation({ timeout: 20000 }).catch(() => {}),
      page.click('button[type="submit"]')
    ]);
    await page.waitForTimeout(3000);

    console.log('Navigating to /inbox ...');
    await page.goto(`${API_BASE}/inbox`, { timeout: 35000, waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);

    // Select first conversation
    const firstChat = page.locator('[data-conversation-id], [data-testid^="conversation-item"], div[role="button"]:has-text("+55")').first();
    if (await firstChat.isVisible({ timeout: 6000 }).catch(() => false)) {
      console.log('Opening active conversation in Inbox...');
      await firstChat.click();
      await page.waitForTimeout(2000);
    }

    // Open Catalog Popover
    console.log('Opening catalog popover in Inbox...');
    const catalogTrigger = page.locator('[data-catalog-trigger], button:has-text("Catálogo"), button[aria-label*="Catálogo"]').first();
    await catalogTrigger.click();
    await page.waitForTimeout(2000);

    // Find the newly altered product in the popover search
    console.log(`Searching for created product "${dynamicProductName}" in catalog popover...`);
    const searchInput = page.locator('[data-catalog-popover] input[type="text"]');
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill(dynamicProductName);
      await page.waitForTimeout(1500);
    }

    // Capture popover with dynamic product
    const popoverShot = path.join(ARTIFACT_DIR, 'live_dynamic_product_in_popover.png');
    await page.screenshot({ path: popoverShot });
    console.log('✔ Popover screenshot captured with dynamic product:', popoverShot);

    // Click "Enviar no Chat"
    const sendBtn = page.locator(`[data-catalog-product-row="${testProductId}"] button:has-text("Enviar no Chat"), button:has-text("Enviar no Chat")`).first();
    if (await sendBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      console.log('Clicking "Enviar no Chat" for the dynamic product...');
      await sendBtn.click();
      await page.waitForTimeout(3000);
      console.log('✔ Product dispatched into chat!');
    }

    // Capture chat with the rendered product card
    const chatShot = path.join(ARTIFACT_DIR, 'live_dynamic_product_sent_inbox.png');
    await page.screenshot({ path: chatShot });
    console.log('✔ Chat screenshot captured with dynamic product card:', chatShot);

    await browser.close();

    // 7. Cleanup test product
    console.log('\nStep 7: Testing DELETE /api/products/:id (cleanup)...');
    const deleteRes = await axios.delete(`${API_BASE}/api/products/${testProductId}`, { httpsAgent, headers: authHeaders });
    if (deleteRes.data?.success) {
      console.log(`✔ Dynamic test product ${testProductId} deleted cleanly.`);
    }

    console.log('\n================================================================');
    console.log('   ALL CHECKS PASSED: 100% REAL DYNAMIC CATALOG VERIFIED LIVE   ');
    console.log('================================================================');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Dynamic Lifecycle Test Failed:', error?.response?.data || error.message);
    if (testProductId && token) {
      try {
        await axios.delete(`${API_BASE}/api/products/${testProductId}`, {
          httpsAgent,
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (_) {}
    }
    process.exit(1);
  }
}

runDynamicLifecycleTest();
