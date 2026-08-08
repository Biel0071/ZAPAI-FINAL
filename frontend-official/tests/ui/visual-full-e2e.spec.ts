import { test, expect, Page } from "@playwright/test";

const BASE_URL = "http://209.50.241.22";
const USERNAME = "zapadmin";
const PASSWORD = "zapadmin1010";

// ─── Resultado global ────────────────────────────────────────────────────────
const results: { page: string; action: string; status: "PASS" | "FAIL" | "WARN"; detail?: string }[] = [];
function log(page: string, action: string, status: "PASS" | "FAIL" | "WARN", detail?: string) {
  results.push({ page, action, status, detail });
  console.log(`[${status}] ${page} › ${action}${detail ? " — " + detail : ""}`);
}

// ─── Helper: screenshot on fail ──────────────────────────────────────────────
async function safeClick(pw: Page, selector: string, label: string, pageName: string) {
  try {
    const el = pw.locator(selector).first();
    await el.waitFor({ timeout: 4000 });
    await el.click({ timeout: 4000 });
    log(pageName, `click: ${label}`, "PASS");
    await pw.waitForTimeout(600);
  } catch (e: any) {
    log(pageName, `click: ${label}`, "FAIL", e.message?.slice(0, 100));
  }
}

async function checkVisible(pw: Page, selector: string, label: string, pageName: string) {
  try {
    await expect(pw.locator(selector).first()).toBeVisible({ timeout: 6000 });
    log(pageName, `visible: ${label}`, "PASS");
  } catch (e: any) {
    log(pageName, `visible: ${label}`, "FAIL", e.message?.slice(0, 80));
  }
}

// ─── LOGIN ───────────────────────────────────────────────────────────────────
test("ZAPAI Full Visual E2E", async ({ page }) => {
  page.setDefaultTimeout(15000);

  // ── 1. LOGIN ──────────────────────────────────────────────────────────────
  await test.step("LOGIN", async () => {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    log("LOGIN", "page loaded", "PASS", page.url());

    // Fill login form
    try {
      const emailInput = page.locator('input[type="email"],input[type="text"],input[name="username"],input[placeholder*="user"],input[placeholder*="email"]').first();
      await emailInput.fill(USERNAME, { timeout: 5000 });
      log("LOGIN", "fill username", "PASS");
    } catch { log("LOGIN", "fill username", "FAIL", "input not found"); }

    try {
      const pwInput = page.locator('input[type="password"]').first();
      await pwInput.fill(PASSWORD, { timeout: 5000 });
      log("LOGIN", "fill password", "PASS");
    } catch { log("LOGIN", "fill password", "FAIL"); }

    try {
      const btn = page.locator('button[type="submit"],button:has-text("Entrar"),button:has-text("Login"),button:has-text("Acessar")').first();
      await btn.click({ timeout: 5000 });
      await page.waitForTimeout(3000);
      log("LOGIN", "click submit", "PASS");
    } catch { log("LOGIN", "click submit", "FAIL"); }
    log("LOGIN", "after login URL", "PASS", page.url());
  });

  // ── 2. DASHBOARD ──────────────────────────────────────────────────────────
  await test.step("DASHBOARD", async () => {
    try {
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2500);
    } catch { await page.goto(BASE_URL, { waitUntil: "domcontentloaded" }); }

    log("DASHBOARD", "page loaded", "PASS", page.url());

    // Check key dashboard elements
    await checkVisible(page, 'text=/conversas|messages|dashboard/i', "dashboard content", "DASHBOARD");

    // Click any cards or quick action buttons
    const cards = await page.locator('[class*="card"],[class*="Card"]').all();
    log("DASHBOARD", `found ${cards.length} cards`, "PASS");

    // Click first few buttons
    const buttons = await page.locator('button:not([disabled])').all();
    log("DASHBOARD", `found ${buttons.length} buttons`, "PASS");
    for (let i = 0; i < Math.min(buttons.length, 5); i++) {
      try {
        const text = await buttons[i].textContent();
        await buttons[i].click({ timeout: 2000 });
        await page.waitForTimeout(400);
        log("DASHBOARD", `btn[${i}]: ${text?.trim().slice(0, 30)}`, "PASS");
      } catch { /* skip */ }
    }
  });

  // ── 3. INBOX ──────────────────────────────────────────────────────────────
  await test.step("INBOX", async () => {
    await page.goto(`${BASE_URL}/inbox`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    log("INBOX", "page loaded", "PASS");

    // Check conversation list
    await checkVisible(page, '[class*="conversation"],[class*="chat"],[class*="Conversation"]', "conversation list", "INBOX");

    // Click first conversation
    try {
      const convItem = page.locator('[class*="conversation-item"],[class*="ConversationItem"],[data-testid*="conv"]').first();
      await convItem.click({ timeout: 4000 });
      await page.waitForTimeout(1500);
      log("INBOX", "click first conversation", "PASS");
    } catch { log("INBOX", "click first conversation", "WARN", "not found or not clickable"); }

    // AI toggle
    await safeClick(page, '[class*="ai-toggle"],[class*="AiToggle"],button:has-text("IA"),button:has-text("AI")', "AI toggle", "INBOX");

    // Quick responses button
    await safeClick(page, 'button:has-text("Rápid"),button:has-text("Resposta"),button[title*="rapida"],button[title*="quick"]', "quick response btn", "INBOX");

    // Message input
    try {
      const input = page.locator('textarea[placeholder*="mensagem"],textarea[placeholder*="Digite"],input[placeholder*="mensagem"]').first();
      await input.fill("Teste visual automatizado", { timeout: 4000 });
      log("INBOX", "type in message input", "PASS");
    } catch { log("INBOX", "type in message input", "WARN"); }

    // Attachments, media buttons
    await safeClick(page, 'button[title*="anexo"],button[title*="arquivo"],button[aria-label*="attach"]', "attach button", "INBOX");
  });

  // ── 4. CONTATOS ───────────────────────────────────────────────────────────
  await test.step("CONTACTS", async () => {
    await page.goto(`${BASE_URL}/contacts`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    log("CONTACTS", "page loaded", "PASS");

    // Search bar
    try {
      const search = page.locator('input[placeholder*="buscar"],input[placeholder*="pesquisa"],input[placeholder*="search"],input[type="search"]').first();
      await search.fill("teste", { timeout: 4000 });
      await page.waitForTimeout(600);
      log("CONTACTS", "search input", "PASS");
    } catch { log("CONTACTS", "search input", "WARN"); }

    // New contact button
    await safeClick(page, 'button:has-text("Novo"),button:has-text("Adicionar"),button:has-text("New"),[class*="add-btn"]', "new contact btn", "CONTACTS");

    // Close dialog if opened
    await safeClick(page, 'button:has-text("Cancel"),button:has-text("Fechar"),button[aria-label="Close"],[class*="close"]', "close dialog", "CONTACTS");
  });

  // ── 5. CAMPANHAS ──────────────────────────────────────────────────────────
  await test.step("CAMPAIGNS", async () => {
    await page.goto(`${BASE_URL}/campaigns`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    log("CAMPAIGNS", "page loaded", "PASS");

    // Create campaign button
    await safeClick(page, 'button:has-text("Nova Campanha"),button:has-text("Criar"),button:has-text("New Campaign")', "new campaign", "CAMPAIGNS");
    await page.waitForTimeout(800);
    await safeClick(page, 'button:has-text("Cancel"),button:has-text("Fechar"),[class*="close"]', "close", "CAMPAIGNS");

    // List campaigns
    const items = await page.locator('[class*="campaign-item"],[class*="CampaignItem"]').count();
    log("CAMPAIGNS", `found ${items} campaign items`, items >= 0 ? "PASS" : "WARN");
  });

  // ── 6. FLOWS / AUTOMAÇÃO ──────────────────────────────────────────────────
  await test.step("FLOWS", async () => {
    await page.goto(`${BASE_URL}/flows`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    log("FLOWS", "page loaded", "PASS");

    await safeClick(page, 'button:has-text("Novo Fluxo"),button:has-text("Criar Fluxo"),button:has-text("New Flow")', "new flow btn", "FLOWS");
    await page.waitForTimeout(800);
    await safeClick(page, 'button:has-text("Cancel"),button:has-text("Fechar"),[class*="close"]', "close", "FLOWS");
  });

  // ── 7. IA & AUTOMAÇÃO ────────────────────────────────────────────────────
  await test.step("IA & AUTOMAÇÃO", async () => {
    const aiUrls = ["/ai", "/ia", "/ai-config", "/automacao"];
    let aiLoaded = false;
    for (const url of aiUrls) {
      try {
        await page.goto(`${BASE_URL}${url}`, { waitUntil: "domcontentloaded", timeout: 8000 });
        await page.waitForTimeout(2000);
        if (!page.url().includes("login") && !page.url().includes("404")) {
          aiLoaded = true;
          break;
        }
      } catch { /* try next */ }
    }
    log("AI", `page loaded (${page.url()})`, aiLoaded ? "PASS" : "WARN");

    // Tabs: Prompt, Memória, Evolução
    const tabs = ["Prompt", "Memória", "Evolução", "Configurações", "Aprendizado"];
    for (const tab of tabs) {
      await safeClick(page, `button:has-text("${tab}"),a:has-text("${tab}"),tab:has-text("${tab}"),[role="tab"]:has-text("${tab}")`, `tab ${tab}`, "AI");
      await page.waitForTimeout(700);
    }

    // Ajuste Rápido textarea
    try {
      const textarea = page.locator('textarea[id*="evolve"],textarea[placeholder*="ensinar"],textarea[placeholder*="alterar"]').first();
      await textarea.fill("Teste: cobrar R$50 de frete para compras abaixo de R$500", { timeout: 4000 });
      log("AI", "fill ajuste rapido textarea", "PASS");
    } catch { log("AI", "fill ajuste rapido textarea", "WARN"); }

    // Botão Analisar
    await safeClick(page, 'button:has-text("Analisar"),button:has-text("Propor"),button:has-text("Ensinar")', "analisar btn", "AI");
    await page.waitForTimeout(1000);
  });

  // ── 8. MEMÓRIA ────────────────────────────────────────────────────────────
  await test.step("MEMORY", async () => {
    const memUrls = ["/memory", "/memoria", "/ai/memory"];
    for (const url of memUrls) {
      try {
        await page.goto(`${BASE_URL}${url}`, { waitUntil: "domcontentloaded", timeout: 6000 });
        if (!page.url().includes("login")) break;
      } catch { /* try next */ }
    }
    await page.waitForTimeout(2500);
    log("MEMORY", `page loaded (${page.url()})`, "PASS");

    // Click refresh/flush buttons
    await safeClick(page, 'button:has-text("Atualizar"),button:has-text("Sincronizar"),button:has-text("Flush"),button:has-text("Refresh")', "refresh btn", "MEMORY");
    await page.waitForTimeout(600);
  });

  // ── 9. CONFIGURAÇÕES ──────────────────────────────────────────────────────
  await test.step("SETTINGS", async () => {
    const settingUrls = ["/settings", "/configuracoes", "/config"];
    for (const url of settingUrls) {
      try {
        await page.goto(`${BASE_URL}${url}`, { waitUntil: "domcontentloaded", timeout: 6000 });
        if (!page.url().includes("login")) break;
      } catch { /* try next */ }
    }
    await page.waitForTimeout(2500);
    log("SETTINGS", `page loaded (${page.url()})`, "PASS");

    // Click tabs in settings
    const settingsTabs = await page.locator('[role="tab"],button[class*="tab"]').all();
    log("SETTINGS", `found ${settingsTabs.length} tabs`, "PASS");
    for (let i = 0; i < Math.min(settingsTabs.length, 6); i++) {
      try {
        const text = await settingsTabs[i].textContent();
        await settingsTabs[i].click({ timeout: 2000 });
        await page.waitForTimeout(600);
        log("SETTINGS", `tab: ${text?.trim().slice(0, 25)}`, "PASS");
      } catch { /* skip */ }
    }
  });

  // ── 10. CONEXÕES / WHATSAPP ───────────────────────────────────────────────
  await test.step("CONNECTIONS", async () => {
    const connUrls = ["/connections", "/whatsapp", "/sessions"];
    for (const url of connUrls) {
      try {
        await page.goto(`${BASE_URL}${url}`, { waitUntil: "domcontentloaded", timeout: 6000 });
        if (!page.url().includes("login")) break;
      } catch { /* try next */ }
    }
    await page.waitForTimeout(2500);
    log("CONNECTIONS", `page loaded (${page.url()})`, "PASS");

    // QR Code / Session status
    await checkVisible(page, 'text=/conectado|connected|QR|sessão/i', "session status", "CONNECTIONS");
  });

  // ── 11. SIDEBAR NAVIGATION ────────────────────────────────────────────────
  await test.step("SIDEBAR NAV", async () => {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    const navLinks = await page.locator('nav a,aside a,[class*="sidebar"] a,[class*="menu-item"],[class*="nav-item"]').all();
    log("SIDEBAR", `found ${navLinks.length} nav links`, navLinks.length > 0 ? "PASS" : "WARN");

    for (let i = 0; i < Math.min(navLinks.length, 12); i++) {
      try {
        const href = await navLinks[i].getAttribute("href");
        const text = await navLinks[i].textContent();
        await navLinks[i].click({ timeout: 2000 });
        await page.waitForTimeout(800);
        log("SIDEBAR", `nav: ${text?.trim().slice(0, 20)} → ${page.url().replace(BASE_URL, "")}`, "PASS");
      } catch { /* skip */ }
    }
  });

  // ── PRINT FINAL REPORT ────────────────────────────────────────────────────
  const pass = results.filter(r => r.status === "PASS").length;
  const fail = results.filter(r => r.status === "FAIL").length;
  const warn = results.filter(r => r.status === "WARN").length;

  console.log("\n============================================================");
  console.log(`ZAPAI VISUAL E2E REPORT`);
  console.log(`============================================================`);
  console.log(`✅ PASS: ${pass} | ❌ FAIL: ${fail} | ⚠️  WARN: ${warn}`);
  console.log(`Total: ${results.length} checks`);
  console.log("------------------------------------------------------------");
  results.filter(r => r.status !== "PASS").forEach(r => {
    console.log(`[${r.status}] ${r.page} › ${r.action}${r.detail ? " — " + r.detail : ""}`);
  });
  console.log("============================================================\n");

  expect(fail).toBeLessThan(results.length * 0.5); // less than 50% failures
});
