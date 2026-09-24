import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("../frontend-official/node_modules/@playwright/test");
import fs from "node:fs";
import path from "node:path";

const targetDir = "C:/Users/Dell/.gemini/antigravity/brain/a7b57dd6-7f7a-4d42-b225-a590ab1c1618/screenshots";
fs.mkdirSync(targetDir, { recursive: true });

async function run() {
  console.log("Logging in via API...");
  const res = await fetch("http://127.0.0.1:4025/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-tenant-id": "default" },
    body: JSON.stringify({ username: "zapadmin", password: "zapadmin123", tenantId: "default" })
  });
  const data = await res.json();
  const token = data.token;
  console.log("Token obtained:", token ? "OK" : "FAILED");

  const browser = await chromium.launch();
  
  // Desktop
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark"
  });
  const page = await context.newPage();

  // Test Login page screenshot first
  console.log("Navigating to /login...");
  await page.goto("http://127.0.0.1:8080/login", { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(targetDir, "desktop_login.png") });
  console.log("Desktop login screenshot saved!");

  // Now inject auth
  await page.evaluate(({ token }) => {
    localStorage.setItem("auth-storage", JSON.stringify({
      state: { token, user: { id: 1, role: "master_admin", username: "zapadmin" }, isAuthenticated: true, companyId: "default" },
      version: 0
    }));
    localStorage.setItem("zapai_admin_auth_session", JSON.stringify({
      token,
      username: "zapadmin",
      role: "master",
      tenantId: "default",
      companyId: "default",
      issuedAt: Date.now(),
      expiresAt: Date.now() + 86400000,
      remember: true
    }));
  }, { token });

  // Navigate to Dashboard
  console.log("Navigating to /dashboard...");
  await page.goto("http://127.0.0.1:8080/dashboard", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(targetDir, "desktop_dashboard.png") });
  console.log("Desktop dashboard screenshot saved!");

  await browser.close();
}

run().catch(console.error);
