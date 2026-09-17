import { chromium, type FullConfig } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
  const authDir = path.join(process.cwd(), 'tests', '.auth');
  const authFile = path.join(authDir, 'user.json');

  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("🔐 [Global Setup] Performing authenticaton for parallel test workers...");
  
  // Directly call the API to login instead of using UI for max speed
  const apiContext = await browser.newContext();
  const loginResponse = await apiContext.request.post('http://127.0.0.1:4025/api/auth/login', {
    data: {
      username: 'zapadmin',
      password: 'zapadmin123',
      tenantId: 'default'
    },
    headers: {
      'x-tenant-id': 'default'
    }
  });

  if (!loginResponse.ok()) {
    console.error("❌ [Global Setup] Authentication API failed. Tests will likely fail.");
    await browser.close();
    return;
  }

  const payload = await loginResponse.json();
  const token = payload?.token ?? payload?.accessToken ?? payload?.data?.token;

  if (token) {
    // Inject token into localStorage for the UI to consume
    await page.goto(baseURL as string);
    await page.evaluate((jwt) => {
      localStorage.setItem('auth-storage', JSON.stringify({
        state: { token: jwt, user: { id: 1, role: 'admin' }, isAuthenticated: true, companyId: 'default' },
        version: 0
      }));
      const adminSession = {
        token: jwt,
        username: 'zapadmin',
        role: 'master',
        tenantId: 'default',
        companyId: 'default',
        issuedAt: Date.now(),
        expiresAt: Date.now() + 1000 * 60 * 60 * 8,
        remember: true,
      };
      localStorage.setItem('zapai_admin_auth_session', JSON.stringify(adminSession));
    }, token);

    // Save state to file for all workers
    await page.context().storageState({ path: authFile });
    console.log(`✅ [Global Setup] Authenticated successfully. State saved to ${authFile}`);
  } else {
    console.error("❌ [Global Setup] Could not extract token from login response.");
  }

  await browser.close();
}

export default globalSetup;
