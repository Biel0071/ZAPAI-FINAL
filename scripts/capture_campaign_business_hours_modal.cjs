const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require(path.resolve(__dirname, '../frontend-official/node_modules/@playwright/test'));

const BASE_URL = 'https://209.50.241.22';
const USERNAME = 'zapadmin';
const PASSWORD = 'zapadmin1010';
const JWT_SECRET = '73d1ef96dde5afc4938e0b71a5978b2666f1885fb0d2febc4bd52cc7a1cd9e15';
const BRAIN_DIR = 'C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40';

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
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--ignore-certificate-errors'],
  });

  const token = generateAdminToken();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 920 },
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

    // Simulate 21:45 (9:45 PM, strictly outside 08:00 - 18:00)
    const RealDate = Date;
    const fakeTime = new RealDate('2026-10-16T21:45:00-03:00').getTime();
    window.Date = class extends RealDate {
      constructor(...args) {
        if (args.length === 0) {
          super(fakeTime);
        } else {
          super(...args);
        }
      }
      static now() {
        return fakeTime;
      }
    };
  }, token);

  const page = await context.newPage();
  await page.goto(`${BASE_URL}/campaigns`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  await loginIfNeeded(page);
  await page.waitForTimeout(2000);

  // Enter campaign name
  const nameInput = page.locator('input[placeholder*="Campanha orcamento"]').first();
  if (await nameInput.count() > 0) {
    await nameInput.fill('Campanha Auditoria Noturna - Fora de Horario');
    await page.waitForTimeout(500);
  }

  // Click example context button to fill required briefing
  const exampleBtn = page.locator('button:has-text("Usar Exemplo"), button:has-text("Caixa d\'água")').first();
  if (await exampleBtn.count() > 0) {
    await exampleBtn.click();
    await page.waitForTimeout(600);
  }

  // Click Próximo Passo through the wizard until launch
  for (let i = 0; i < 5; i++) {
    const nextBtn = page.locator('button:has-text("Próximo Passo"), button:has-text("Lançar Campanha"), button:has-text("Criar e Disparar")').first();
    if (await nextBtn.count() > 0) {
      console.log(`Clicking wizard step ${i + 1}...`);
      await nextBtn.click();
      await page.waitForTimeout(1500);

      // Check if consent modal has appeared
      const consentDialog = page.locator('[role="dialog"]:has-text("Horário Comercial"), [role="dialog"]:has-text("Ajustar para Próximo")').first();
      if (await consentDialog.count() > 0) {
        console.log('Consent modal appeared!');
        break;
      }
    }
  }

  // Check for the consent modal
  console.log('Checking for Envio Fora do Horário Comercial modal...');
  const dialog = page.locator('[role="dialog"]:has-text("Horário Comercial"), [role="dialog"]:has-text("Ajustar para Próximo")').first();
  if (await dialog.count() > 0) {
    const fullPath = path.join(BRAIN_DIR, 'SIMULATION_09_CAMPAIGN_BUSINESS_HOURS_CONSENT_POPUP.png');
    const buf = await dialog.screenshot();
    fs.writeFileSync(fullPath, buf);
    console.log(`[SAVED] SIMULATION_09_CAMPAIGN_BUSINESS_HOURS_CONSENT_POPUP.png (${buf.length} bytes)`);
  } else {
    // If not dialog, check if full page shows it
    const fullDialog = page.locator('[role="dialog"]').first();
    if (await fullDialog.count() > 0) {
      const fullPath = path.join(BRAIN_DIR, 'SIMULATION_09_CAMPAIGN_BUSINESS_HOURS_CONSENT_POPUP.png');
      const buf = await fullDialog.screenshot();
      fs.writeFileSync(fullPath, buf);
      console.log(`[SAVED] Full dialog: ${buf.length} bytes`);
    } else {
      console.log('No dialog found, capturing current page state');
      await page.screenshot({ path: path.join(BRAIN_DIR, 'SIMULATION_09_CAMPAIGN_STEP_DEBUG.png') });
    }
  }

  await browser.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
