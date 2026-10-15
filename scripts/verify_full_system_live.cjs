const fs = require('fs');
const path = require('path');
const https = require('https');
const { chromium } = require('../frontend-official/node_modules/@playwright/test/index.js');

const ARTIFACT_DIR = 'C:\\Users\\Dell\\.gemini\\antigravity\\brain\\578a7157-8bf3-47e3-82f2-9ed1bb8f9f40';
const BASE_URL = 'https://209.50.241.22';
const USERNAME = 'zapadmin';
const PASSWORD = 'zapadmin1010';

function fetchRealToken() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ username: USERNAME, password: PASSWORD });
    const req = https.request('https://209.50.241.22/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
      rejectUnauthorized: false,
    }, (res) => {
      let b = '';
      res.on('data', (c) => (b += c));
      res.on('end', () => {
        try {
          const json = JSON.parse(b);
          if (json.token) resolve(json.token);
          else reject(new Error('No token in login response: ' + b));
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function loginIfNeeded(page) {
  if (page.url().includes('login') || (await page.locator('#login-password, input[type="password"]').count()) > 0) {
    await page.waitForSelector('#login-username, input[type="text"]', { timeout: 6000 }).catch(() => {});
    await page.fill('#login-username', USERNAME).catch(async () => {
      await page.locator('input[type="text"]').first().fill(USERNAME);
    });
    await page.fill('#login-password', PASSWORD).catch(async () => {
      await page.locator('input[type="password"]').first().fill(PASSWORD);
    });
    await page.click('button[type="submit"]');
    await page.waitForTimeout(4000);
  }
}

async function main() {
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  console.log('1. Fetching real JWT token from VPS...');
  const token = await fetchRealToken();
  console.log('   Token acquired successfully (length:', token.length, ')');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });

  await context.addInitScript((jwt) => {
    try {
      window.localStorage.setItem('zapflow_token', jwt);
      window.localStorage.setItem('auth_token', jwt);
      window.localStorage.setItem('token', jwt);
    } catch {}
  }, token);

  const page = await context.newPage();
  const consoleErrors = [];
  const apiFailures = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('favicon') && !text.includes('ResizeObserver')) {
        consoleErrors.push(text);
      }
    }
  });

  page.on('response', (res) => {
    const url = res.url();
    const status = res.status();
    if (url.includes('/api/') && status >= 500) {
      apiFailures.push(`${status} ${url}`);
    } else if (status === 404) {
      console.log(`   [404] ${url}`);
    }
  });

  // 1. DASHBOARD HUB 1 & HUB 2
  console.log('2. Validating /dashboard ...');
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);
  await loginIfNeeded(page);
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  const geralBtn = page.locator('button:has-text("Geral")').first();
  if (await geralBtn.isVisible().catch(() => false)) {
    await geralBtn.click();
    await page.waitForTimeout(2500);
  }
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'FINAL_VERIFY_01_DASHBOARD_HUB1.png') });

  const mapTab = page.locator('button:has-text("Mapa"), [role="tab"]:has-text("Mapa")').first();
  if (await mapTab.isVisible().catch(() => false)) {
    await mapTab.click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'FINAL_VERIFY_02_DASHBOARD_HUB2_MAP.png') });
  }

  // 2. INBOX (DESKTOP 1440x900)
  console.log('3. Validating /inbox ...');
  await page.goto(`${BASE_URL}/inbox`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4500);

  const convRows = page.locator('.inbox-message');
  const convCount = await convRows.count();
  console.log(`   Inbox loaded ${convCount} visible conversation rows.`);

  // Click an individual conversation (e.g. second or third row)
  if (convCount > 2) {
    await convRows.nth(2).click();
    await page.waitForTimeout(2500);
  } else if (convCount > 0) {
    await convRows.first().click();
    await page.waitForTimeout(2500);
  }
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'FINAL_VERIFY_03_INBOX_ACTIVE_CHAT.png') });

  // Check Quick Replies tab in SidebarPanel
  const qrTab = page.locator('[role="tab"][value="qr"], button[role="tab"]:has-text("Respostas")').first();
  if (await qrTab.isVisible().catch(() => false)) {
    await qrTab.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'FINAL_VERIFY_04_INBOX_QUICK_REPLIES.png') });
  }

  // 3. CONNECTIONS
  console.log('4. Validating /connections ...');
  await page.goto(`${BASE_URL}/connections`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'FINAL_VERIFY_05_CONNECTIONS.png') });

  // 4. ATTENDANTS (Avatar Studio + Config + Memory & Evolution)
  console.log('5. Validating /attendants ...');
  await page.goto(`${BASE_URL}/attendants`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'FINAL_VERIFY_06_ATTENDANTS_STUDIO.png') });

  const memBtn = page.locator('button:has-text("Memória & Evolução")').first();
  if (await memBtn.isVisible().catch(() => false)) {
    await memBtn.click();
    await page.waitForTimeout(5500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'FINAL_VERIFY_07_ATTENDANTS_MEMORY_GRAPH.png') });
  }

  // 5. AI & AUTOMATION
  console.log('6. Validating /ai ...');
  await page.goto(`${BASE_URL}/ai`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'FINAL_VERIFY_08_AI_AUTOMATION.png') });

  // 6. CAMPAIGNS
  console.log('7. Validating /campaigns ...');
  await page.goto(`${BASE_URL}/campaigns`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'FINAL_VERIFY_09_CAMPAIGNS.png') });

  // 7. CONTACTS
  console.log('8. Validating /contacts ...');
  await page.goto(`${BASE_URL}/contacts`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'FINAL_VERIFY_10_CONTACTS.png') });

  // 8. SETTINGS
  console.log('9. Validating /settings ...');
  await page.goto(`${BASE_URL}/settings`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'FINAL_VERIFY_11_SETTINGS.png') });

  // 9. FLOATING ASSISTENTE ZAI
  console.log('10. Validating Floating Assistente ZAI ...');
  const floatBtn = page.locator('button[aria-label*="Assistente ZAI" i], button[title*="Assistente ZAI" i]').first();
  if (await floatBtn.isVisible().catch(() => false)) {
    await floatBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'FINAL_VERIFY_12_FLOATING_ZAIBOT.png') });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  // 10. MOBILE VIEWPORT (390x844) INBOX
  console.log('11. Validating Mobile (390x844) Inbox ...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE_URL}/inbox`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'FINAL_VERIFY_13_MOBILE_INBOX.png') });

  console.log('\n=== VERIFICATION SUMMARY ===');
  console.log('API 5xx Failures:', apiFailures.length, apiFailures);
  console.log('Console Errors:', consoleErrors.length, consoleErrors.slice(0, 5));

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
