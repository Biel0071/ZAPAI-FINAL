import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("../frontend-official/node_modules/@playwright/test");
import fs from "node:fs";
import path from "node:path";

const targetDir = "C:/Users/Dell/.gemini/antigravity/brain/a7b57dd6-7f7a-4d42-b225-a590ab1c1618/screenshots";
fs.mkdirSync(targetDir, { recursive: true });

const pages = [
  { name: "login", url: "http://127.0.0.1:8080/login", authRequired: false, title: "Tela de Login" },
  { name: "dashboard_overview", url: "http://127.0.0.1:8080/dashboard", authRequired: true, title: "Dashboard Geral" },
  { name: "dashboard_conversations", url: "http://127.0.0.1:8080/dashboard?tab=conversations", authRequired: true, title: "Dashboard Conversas" },
  { name: "dashboard_ai", url: "http://127.0.0.1:8080/dashboard?tab=ai", authRequired: true, title: "Dashboard Performance IA" },
  { name: "dashboard_commercial", url: "http://127.0.0.1:8080/dashboard?tab=commercial", authRequired: true, title: "Dashboard Comercial" },
  { name: "dashboard_map", url: "http://127.0.0.1:8080/dashboard?tab=map", authRequired: true, title: "Dashboard Mapa Interativo" },
  { name: "inbox", url: "http://127.0.0.1:8080/inbox", authRequired: true, title: "Inbox de Atendimento" },
  { name: "connections", url: "http://127.0.0.1:8080/connections", authRequired: true, title: "Conexões WhatsApp" },
  { name: "contacts", url: "http://127.0.0.1:8080/contacts", authRequired: true, title: "Gestão de Contatos CRM" },
  { name: "campaigns", url: "http://127.0.0.1:8080/campaigns", authRequired: true, title: "Campanhas de Disparo" },
  { name: "operations", url: "http://127.0.0.1:8080/operations", authRequired: true, title: "Painel de Operações" },
  { name: "ai", url: "http://127.0.0.1:8080/ai", authRequired: true, title: "Configuração de IA & Agentes" },
  { name: "flows", url: "http://127.0.0.1:8080/flows", authRequired: true, title: "Editor de Fluxos" },
  { name: "memory", url: "http://127.0.0.1:8080/memory", authRequired: true, title: "Memória do Sistema" },
  { name: "settings_general", url: "http://127.0.0.1:8080/settings", authRequired: true, title: "Configurações Gerais" },
  { name: "settings_queue", url: "http://127.0.0.1:8080/settings?tab=queue", authRequired: true, title: "Configurações - Filas" },
  { name: "settings_diagnostics", url: "http://127.0.0.1:8080/settings?tab=diagnostics", authRequired: true, title: "Diagnósticos e Runtime" },
  { name: "settings_users", url: "http://127.0.0.1:8080/settings?tab=users", authRequired: true, title: "Gestão de Usuários" },
];

async function captureAll() {
  console.log("=== INICIANDO CAPTURA DE TELAS ZAPFLOW AI ===");
  
  // 1. Obter Token
  const loginRes = await fetch("http://127.0.0.1:4025/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-tenant-id": "default" },
    body: JSON.stringify({ username: "zapadmin", password: "zapadmin123", tenantId: "default" })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  if (!token) throw new Error("Falha ao obter token de login");
  console.log("Token JWT obtido com sucesso.");

  const browser = await chromium.launch();

  // Helper para injetar auth
  async function setupAuth(page) {
    await page.goto("http://127.0.0.1:8080/login", { waitUntil: "commit" });
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
  }

  // --- CAPTURA DESKTOP (1440x900) ---
  console.log("\n📸 Capturando telas DESKTOP (1440x900)...");
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark"
  });
  const desktopPage = await desktopContext.newPage();
  await setupAuth(desktopPage);

  for (const item of pages) {
    const filename = `desktop_${item.name}.png`;
    const filepath = path.join(targetDir, filename);
    console.log(`[Desktop] Acessando ${item.title} (${item.url})...`);
    try {
      await desktopPage.goto(item.url, { waitUntil: "networkidle", timeout: 15000 });
    } catch {
      console.warn(`[Desktop] Timeout networkidle em ${item.url}, continuando...`);
    }
    await desktopPage.waitForTimeout(2000);
    await desktopPage.screenshot({ path: filepath, fullPage: false });
    console.log(`  -> Salvo: ${filename}`);
  }
  await desktopContext.close();

  // --- CAPTURA MOBILE (390x844 - iPhone) ---
  console.log("\n📱 Capturando telas MOBILE (390x844)...");
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
    colorScheme: "dark"
  });
  const mobilePage = await mobileContext.newPage();
  await setupAuth(mobilePage);

  for (const item of pages) {
    const filename = `mobile_${item.name}.png`;
    const filepath = path.join(targetDir, filename);
    console.log(`[Mobile] Acessando ${item.title} (${item.url})...`);
    try {
      await mobilePage.goto(item.url, { waitUntil: "networkidle", timeout: 15000 });
    } catch {
      console.warn(`[Mobile] Timeout networkidle em ${item.url}, continuando...`);
    }
    await mobilePage.waitForTimeout(2000);
    await mobilePage.screenshot({ path: filepath, fullPage: false });
    console.log(`  -> Salvo: ${filename}`);
  }
  await mobileContext.close();

  await browser.close();
  console.log("\n🎉 TODAS AS TELAS FORAM CAPTURADAS COM SUCESSO!");
}

captureAll().catch((err) => {
  console.error("Erro durante a captura de telas:", err);
  process.exit(1);
});
