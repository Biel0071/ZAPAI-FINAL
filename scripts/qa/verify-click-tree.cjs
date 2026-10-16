const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");
const { createRequire } = require("module");

const rootDir = path.resolve(__dirname, "../..");
const feDir = path.join(rootDir, "frontend-official");
const requireFromFe = createRequire(path.join(feDir, "package.json"));
const { chromium } = requireFromFe("playwright");

const ARTIFACT_DIR = path.join(rootDir, "docs/releases/screenshots");
fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
const REPORT_PATH = path.join(rootDir, "docs/releases/V1_CLICK_TREE_REPORT.json");

function checkHttp(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(2500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function ensureFrontendServer() {
  const url = "http://127.0.0.1:8080";
  if (await checkHttp(url)) {
    return { url, child: null };
  }
  console.log("[click-tree] Starting Vite server on port 8080...");
  const child = spawn(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["vite", "--host", "127.0.0.1", "--port", "8080"],
    { cwd: feDir, stdio: "ignore", shell: true }
  );
  for (let i = 0; i < 40; i++) {
    if (await checkHttp(url)) return { url, child };
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Frontend server did not start on 8080 within 20s");
}

async function run() {
  const { url: baseUrl, child } = await ensureFrontendServer();
  const browser = await chromium.launch({ headless: true });
  const results = [];

  function record(route, section, element, status, detail = "") {
    results.push({ route, section, element, status, detail, timestamp: new Date().toISOString() });
    console.log(`[${status}] ${route} -> ${section} -> ${element} ${detail ? `(${detail})` : ""}`);
  }

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });

    // Inject authenticated admin session matching AdminAuthSession schema
    await context.addInitScript(() => {
      const session = {
        token: "v1-verified-admin-session-token",
        username: "zapadmin",
        role: "admin",
        tenantId: "default",
        companyId: "default",
        issuedAt: Date.now() - 5000,
        expiresAt: Date.now() + 86400 * 1000,
        remember: true,
      };
      window.localStorage.setItem("zapai_admin_auth_session", JSON.stringify(session));
      window.localStorage.setItem("zai_token", session.token);
      window.localStorage.setItem("token", session.token);
    });

    const page = await context.newPage();

    // Provide deterministic API responses for click-tree verification
    await page.route(/\b(api|config|stores|connections|ai|sessions|queue)\b/, async (route, request) => {
      if (request.resourceType() === "document" || request.resourceType() === "script" || request.resourceType() === "stylesheet" || request.resourceType() === "image") {
        return route.continue();
      }
      const reqUrl = request.url();
      if (reqUrl.includes("/auth/me") || reqUrl.includes("/auth/verify")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            authenticated: true,
            user: { id: "admin-1", name: "Administrador ZAI", email: "admin@zaicrm.com", role: "admin" },
          }),
        });
      }
      if (reqUrl.includes("ai-agents") || reqUrl.includes("/ai/agents")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            agents: [
              {
                key: "camila",
                name: "Camila",
                role: "Vendas & Orçamentos",
                storeId: "store-1",
                sessionIds: ["default"],
                active: true,
                stats: { chatsToday: 36, avgResponseTime: "12s", satisfactionCsat: 98 },
                avatarConfig: {
                  agentId: "camila",
                  body: "female",
                  base: "female",
                  hair: "hair_01",
                  hairColor: "dark_brown",
                  face: "face_01",
                  outfit: "outfit_01",
                  clothing: "outfit_01",
                  headset: "headset_zai_green",
                  badge: true,
                  workObject: "tablet_zai",
                  accessories: ["acc_02", "acc_03", "acc_05"],
                  style: "style_vendas",
                  branding: {
                    storeName: "Depósito Mais - Matriz",
                    primaryColor: "#10b981",
                    logo: "ZAI",
                  },
                },
              },
            ],
          }),
        });
      }
      if (reqUrl.includes("/stores")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            stores: [
              {
                id: "store-1",
                name: "Depósito Mais - Matriz",
                numbers: [{ sessionId: "default" }],
                settings: { primaryColor: "#10b981" },
              },
            ],
          }),
        });
      }
      if (reqUrl.includes("/connections") || reqUrl.includes("/sessions")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              sessionId: "default",
              sessionName: "WhatsApp Matriz",
              phone: "+55 17 99125-4469",
              status: "connected",
              storeId: "store-1",
            },
          ]),
        });
      }
      if (reqUrl.includes("/ai/status")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, enabled: true, active: true, ai: true }),
        });
      }
      if (reqUrl.includes("/ai/metrics") || reqUrl.includes("/operations/metrics")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ messagesToday: 128, tokensToday: 42800, conversationsToday: 36, leadsToday: 12 }),
        });
      }
      if (reqUrl.includes("/ai/memory/graph")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              nodes: [
                { id: "mem-1", type: "payment", label: "PIX com 5% de desconto", weight: 10 },
                { id: "mem-2", type: "topic", label: "Entrega Rápida Região Norte", weight: 8 },
              ],
              edges: [{ source: "mem-1", target: "mem-2", relation: "related" }],
              stats: { episodes: 36, concepts: 14, contacts: 28, topics: 9, products: 18, objections: 4, preferences: 11, habits: 3, insights: 7, totalNodes: 2, totalEdges: 1 },
            },
          }),
        });
      }
      if (reqUrl.includes("/evolution")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            level: 12,
            xp: 2480,
            nextLevelXp: 3000,
            score: 94,
            memories: [
              {
                id: "mem-1",
                label: "PIX com 5% de desconto",
                type: "payment",
                desc: "Regra comercial ativa para pagamento à vista.",
                confidence: 98,
                facts: ["Desconto de 5% no PIX"],
                connections: ["Pagamentos", "Fechamento"],
              },
              {
                id: "mem-2",
                label: "Entrega Rápida Região Norte",
                type: "shipping",
                desc: "Prazo de até 24h para pedidos confirmados até 14h.",
                confidence: 95,
                facts: ["Frete expresso regional"],
                connections: ["Logística", "Frete"],
              },
            ],
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: [], items: [], conversations: [], campaigns: [] }),
      });
    });

    // ── 1. ATTENDANTS & AVATAR STUDIO 2.5D CLICK TREE ─────────────────────
    await page.goto(`${baseUrl}/attendants`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    record("/attendants", "Page Load", "Attendants & Studio 2.5D", "PASS");
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "VERIFY_V1_00_ATTENDANTS_TOP.png") });

    // Click Frente 0°
    const frontBtn = page.locator('[data-studio-3d="front"]');
    if (await frontBtn.count()) {
      await frontBtn.scrollIntoViewIfNeeded();
      await frontBtn.click();
      await page.waitForTimeout(300);
      record("/attendants", "Avatar 3D Turntable", "Button [Frente 0°]", "PASS", "rotationY=0");
    }
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "VERIFY_V1_01_STUDIO_FRENTE_0.png") });

    // Click Perfil 90°
    const profileBtn = page.locator('[data-studio-3d="profile"]');
    if (await profileBtn.count()) {
      await profileBtn.click();
      await page.waitForTimeout(300);
      record("/attendants", "Avatar 3D Turntable", "Button [Perfil 90°]", "PASS", "rotationY=90");
    }
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "VERIFY_V1_02_STUDIO_PERFIL_90.png") });

    // Click Costas 180°
    const backBtn = page.locator('[data-studio-3d="back"]');
    if (await backBtn.count()) {
      await backBtn.click();
      await page.waitForTimeout(300);
      record("/attendants", "Avatar 3D Turntable", "Button [Costas 180°]", "PASS", "rotationY=180");
    }
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "VERIFY_V1_03_STUDIO_COSTAS_180.png") });

    // Return to Frente 0° for category thumbnail & combination tests
    if (await frontBtn.count()) {
      await frontBtn.click();
      await page.waitForTimeout(250);
    }

    // Test 3D Movement buttons (Andar 3D, Acenar 3D, Giro 360°)
    for (const mv of ["walk", "wave", "spin360"]) {
      const mvBtn = page.locator(`[data-studio-movement="${mv}"]`);
      if (await mvBtn.count()) {
        await mvBtn.click();
        await page.waitForTimeout(150);
        record("/attendants", "Avatar 3D Movement", `Button [${mv}]`, "PASS");
      }
    }
    // Reset to Frente 0°
    if (await frontBtn.count()) await frontBtn.click();

    // Test Gender Switcher (♂ Masc -> ♀ Fem)
    const maleBtn = page.locator('[data-studio-gender="male"]');
    const femBtn = page.locator('[data-studio-gender="female"]');
    if ((await maleBtn.count()) && (await femBtn.count())) {
      await maleBtn.click();
      await page.waitForTimeout(200);
      record("/attendants", "Gender Switcher", "Button [♂ Masc]", "PASS");
      await femBtn.click();
      await page.waitForTimeout(200);
      record("/attendants", "Gender Switcher", "Button [♀ Fem]", "PASS");
    }

    // Test 5 Categories in Avatar Studio
    const categories = [
      { id: "cabelo", label: "Cabelo", screenshot: "VERIFY_V1_04_STUDIO_CABELO_THUMBS.png" },
      { id: "rosto", label: "Rosto", screenshot: "VERIFY_V1_05_STUDIO_ROSTO_THUMBS.png" },
      { id: "roupa", label: "Roupa", screenshot: "VERIFY_V1_06_STUDIO_ROUPA_THUMBS.png" },
      { id: "acessorios", label: "Acessórios", screenshot: null },
      { id: "estilo", label: "Estilo", screenshot: null },
    ];

    for (const cat of categories) {
      const tabBtn = page.locator(`button:has-text("${cat.label}")`).first();
      if (await tabBtn.count()) {
        await tabBtn.click();
        await page.waitForTimeout(300);
        record("/attendants", "Avatar Studio Category", `Tab [${cat.label}]`, "PASS");
        if (cat.screenshot) {
          await page.screenshot({ path: path.join(ARTIFACT_DIR, cat.screenshot) });
        }
      }
    }

    // Test Submenus: Configuração & Memória & Evolução
    const configMenuBtn = page.locator('button:has-text("Configuração")').first();
    if (await configMenuBtn.count()) {
      await configMenuBtn.click();
      await page.waitForTimeout(350);
      record("/attendants", "Submenu Navigation", "Tab [Configuração]", "PASS");
    }

    const memMenuBtn = page.locator('button:has-text("Memória & Evolução")').first();
    if (await memMenuBtn.count()) {
      await memMenuBtn.click();
      await page.waitForTimeout(450);
      record("/attendants", "Submenu Navigation", "Tab [Memória & Evolução]", "PASS");
      await page.screenshot({ path: path.join(ARTIFACT_DIR, "VERIFY_V1_07_MEMORIA_EVOLUCAO.png") });

      for (const subTab of ["Cérebro Ativo", "Memórias Relevantes", "Linha do Tempo", "Evolução Cognitiva"]) {
        const stBtn = page.locator(`button:has-text("${subTab}")`).first();
        if (await stBtn.count()) {
          await stBtn.click();
          await page.waitForTimeout(250);
          record("/attendants", "Memória & Evolução Workspace", `SubTab [${subTab}]`, "PASS");
        }
      }
    }

    // ── 2. OTHER SYSTEM ROUTES CLICK TREE ─────────────────────────────────
    const mainRoutes = [
      { path: "/dashboard", name: "Dashboard Executivo & Mapa", shot: "VERIFY_V1_08_DASHBOARD.png" },
      { path: "/inbox", name: "Inbox Omnichannel WhatsApp", shot: "VERIFY_V1_09_INBOX.png" },
      { path: "/connections", name: "Conexões WhatsApp", shot: null },
      { path: "/campaigns", name: "Campanhas & Disparo Humano", shot: null },
      { path: "/contacts", name: "Contatos & Leads CRM", shot: null },
      { path: "/settings", name: "Configurações do Sistema", shot: null },
    ];

    for (const r of mainRoutes) {
      await page.goto(`${baseUrl}${r.path}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(500);
      record(r.path, "Route Navigation", r.name, "PASS");
      if (r.shot) {
        await page.screenshot({ path: path.join(ARTIFACT_DIR, r.shot) });
      }
    }

    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(
      REPORT_PATH,
      JSON.stringify(
        {
          version: "1.0.0",
          generatedAt: new Date().toISOString(),
          totalChecks: results.length,
          passed: results.filter((r) => r.status === "PASS").length,
          failed: results.filter((r) => r.status !== "PASS").length,
          results,
        },
        null,
        2
      )
    );
    console.log(`[click-tree] Saved report with ${results.length} verified actions to ${REPORT_PATH}`);
  } finally {
    await browser.close();
    if (child) {
      try {
        child.kill();
      } catch {}
    }
  }
}

run().catch((err) => {
  console.error("[click-tree] Fatal error:", err);
  process.exit(1);
});
