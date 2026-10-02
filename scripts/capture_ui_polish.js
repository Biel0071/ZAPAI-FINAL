import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pkg from "../frontend-official/node_modules/@playwright/test/index.js";
const { chromium } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 5188;
const DIST_DIR = path.resolve(__dirname, "../frontend-official/dist");
const ARTIFACTS_DIR = "C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40";

if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

function startStaticServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = req.url.split("?")[0];
      if (reqPath === "/") reqPath = "/index.html";

      let filePath = path.join(DIST_DIR, reqPath);
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(DIST_DIR, "index.html");
      }

      const ext = path.extname(filePath);
      const contentType = MIME_TYPES[ext] || "application/octet-stream";

      try {
        const content = fs.readFileSync(filePath);
        res.writeHead(200, { "Content-Type": contentType });
        res.end(content);
      } catch (err) {
        res.writeHead(500);
        res.end("Internal Server Error: " + err.message);
      }
    });

    server.listen(PORT, "127.0.0.1", () => {
      console.log(`[Preview Server] Serving ${DIST_DIR} on http://127.0.0.1:${PORT}`);
      resolve(server);
    });
  });
}

const SAMPLE_CONVERSATIONS = [
  {
    id: "conv-1",
    contactName: "Mariana Souza - Construtora Silva",
    phone: "5531988887777",
    lastMessage: "Perfeito, vou verificar o orçamento que você me enviou.",
    lastMessageType: "text",
    updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    unread: 2,
    tags: ["Cliente", "Orçamento", "VIP"],
    sessionId: "main",
    aiEnabled: true,
    status: "active",
  },
  {
    id: "conv-2",
    contactName: "Carlos Eduardo Oliveira",
    phone: "5531999991122",
    lastMessage: "Qual o prazo de entrega para Belo Horizonte?",
    lastMessageType: "text",
    updatedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    unread: 0,
    tags: ["Novo Lead"],
    sessionId: "main",
    aiEnabled: true,
    status: "active",
  },
  {
    id: "conv-3",
    contactName: "Ana Paula Engenharia",
    phone: "5531977773344",
    lastMessage: "Aprovado! Pode enviar os boletos por favor.",
    lastMessageType: "text",
    updatedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    unread: 0,
    tags: ["Venda", "VIP"],
    sessionId: "main",
    aiEnabled: false,
    status: "active",
  },
];

const SAMPLE_MESSAGES = [
  {
    id: "msg-101",
    conversationId: "conv-1",
    content: "Olá! Gostaria de uma cotação para 50 sacos de cimento CP-II e argamassa AC-III com entrega no bairro Sion.",
    fromMe: false,
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    status: "read",
  },
  {
    id: "msg-102",
    conversationId: "conv-1",
    content: "Olá Mariana! Tudo ótimo! Montei sua cotação especial com frete rápido incluso para entrega amanhã cedo no Sion. O valor total fica R$ 1.840,00 com pagamento facilitado em até 3x sem juros.",
    fromMe: true,
    isAiGenerated: true,
    agentName: "Camila • Especialista ZAI",
    createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    status: "read",
  },
  {
    id: "msg-103",
    conversationId: "conv-1",
    content: "Perfeito, vou verificar o orçamento que você me enviou.",
    fromMe: false,
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    status: "read",
  },
];

const SAMPLE_MATURATION = {
  sessionId: "main",
  daysActive: 525,
  totalLifetimeMessages: 35145,
  firstMessageAt: "2025-04-25T14:26:18.000Z",
  stage: 5,
  stageName: "Chip Maduro & Consolidado",
  recommendedDailyLimit: 500,
  sentToday: 82,
  campaignSentToday: 0,
  remainingQuota: 418,
  progressPercent: 16,
  safeSpeedRecommendation: "balanced",
  riskLevel: "seguro",
  progressionTable: [
    { stage: 1, phase: "Fase 1 (Dias 1-2)", limit: 30, speed: "Modo Seguro (Humano)", status: "concluido" },
    { stage: 2, phase: "Fase 2 (Dias 3-4)", limit: 60, speed: "Modo Seguro (Humano)", status: "concluido" },
    { stage: 3, phase: "Fase 3 (Dias 5-7)", limit: 120, speed: "Modo Equilibrado", status: "concluido" },
    { stage: 4, phase: "Fase 4 (Semana 2)", limit: 250, speed: "Modo Equilibrado", status: "concluido" },
    { stage: 5, phase: "Fase 5 (Maduro 15d+)", limit: 500, speed: "Escala Comercial", status: "atual" },
  ]
};

const SAMPLE_CAMPAIGNS = [
  {
    id: "cmp-1",
    name: "Recuperação de Orçamentos Quentes",
    status: "scheduled",
    createdAt: new Date(Date.now() - 3600 * 1000).toISOString(),
    tags: ["orcamento", "vip"],
    selectedContacts: Array(45).fill({ phone: "5531988887777", name: "Contato" }),
    settings: {
      startAt: new Date(Date.now() + 7200 * 1000).toISOString(),
      preset: "safe",
    },
    messages: [
      {
        id: "m-1",
        content: "Olá! Notei seu interesse no orçamento recente de materiais. Restou alguma dúvida sobre prazos ou pagamento?",
      }
    ]
  },
  {
    id: "cmp-2",
    name: "Aviso de Chegada de Estoque CP-II",
    status: "running",
    createdAt: new Date(Date.now() - 86400 * 1000).toISOString(),
    tags: ["estoque", "clientes"],
    selectedContacts: Array(120).fill({ phone: "5531988887777", name: "Contato" }),
    settings: {
      startAt: new Date(Date.now() - 3600 * 1000).toISOString(),
      preset: "balanced",
    },
    messages: [
      {
        id: "m-2",
        content: "Novos lotes de cimento acabaram de chegar com valor promocional para entrega nesta semana!",
      }
    ]
  }
];

async function setupPageRoutes(page) {
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();

    if (url.includes("/api/auth/me") || url.includes("/api/auth/session") || url.includes("/api/auth/check")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ authenticated: true, user: { username: "zapadmin", role: "admin" } }),
      });
    }

    if (url.includes("/api/sessions")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [
            { id: "main", name: "WhatsApp Principal (Comercial)", status: "connected", connected: true }
          ]
        }),
      });
    }

    if (url.includes("/api/conversations")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: SAMPLE_CONVERSATIONS }),
      });
    }

    if (url.includes("/api/messages") || url.includes("/api/chats/")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: SAMPLE_MESSAGES }),
      });
    }

    if (url.includes("/api/campaigns/maturation")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: SAMPLE_MATURATION }),
      });
    }

    if (url.includes("/api/campaigns")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: SAMPLE_CAMPAIGNS, campaigns: SAMPLE_CAMPAIGNS }),
      });
    }

    if (url.includes("/api/ai/status")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: { enabled: true, active: true, status: "enabled" } }),
      });
    }

    if (url.includes("/api/ai/agents")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [
            { key: "default", id: "agent-1", name: "Camila • Especialista ZAI", role: "Consultora Comercial", active: true }
          ]
        }),
      });
    }

    if (url.includes("/api/quick-replies")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [
            { id: "qr-1", title: "Catálogo de Produtos", category: "Vendas", text: "Aqui está nosso catálogo oficial atualizado!", favorite: true },
            { id: "qr-2", title: "Dados Pix / Pagamento", category: "Financeiro", text: "Chave Pix CNPJ: 12.345.678/0001-90", favorite: true }
          ]
        }),
      });
    }

    // Default mock response for other API routes
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data: {} }),
    });
  });
}

async function main() {
  const server = await startStaticServer();
  const browser = await chromium.launch({ headless: true });

  const seedPayload = {
    session: {
      token: "mock-valid-jwt-token.payload.signature",
      username: "zapadmin",
      role: "admin",
      tenantId: "default",
      companyId: "default",
      issuedAt: Date.now(),
      expiresAt: Date.now() + 864000000,
      remember: true,
    },
    conversations: SAMPLE_CONVERSATIONS,
    messages: SAMPLE_MESSAGES,
  };

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });

    await context.addInitScript(({ session, conversations, messages }) => {
      const sessionStr = JSON.stringify(session);
      window.localStorage.setItem("zapai_admin_auth_session", sessionStr);
      window.sessionStorage.setItem("zapai_admin_auth_session", sessionStr);
      window.localStorage.setItem("theme", "dark");
      window.localStorage.setItem("selectedSessionId", "main");
      window.localStorage.setItem("currentSessionId", "main");
      window.localStorage.setItem("activeSessionId", "main");
      window.localStorage.setItem("zapai_inbox_conversations", JSON.stringify(conversations));
      window.localStorage.setItem("zapai_inbox_messages:main:5531988887777", JSON.stringify(messages));
      window.localStorage.setItem("zapai_inbox_messages:main:conv-1", JSON.stringify(messages));
      document.documentElement.classList.add("dark");
    }, seedPayload);

    const page = await context.newPage();
    await setupPageRoutes(page);

    // 1. CAPTURE INBOX WITH POLISHED CHAT & SLASH COMMAND AUTOCOMPLETE
    console.log("[Capture] Loading Inbox...");
    await page.goto(`http://127.0.0.1:${PORT}/inbox`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    // Click on first conversation if available
    const firstConv = page.locator(".inbox-message").first();
    if (await firstConv.isVisible()) {
      await firstConv.click();
      await page.waitForTimeout(800);
    }

    // Type "/" into composer to show polished slash commands dropdown (/learn, /boost, /goal, /plan)
    const composer = page.locator("textarea").first();
    if (await composer.isVisible()) {
      await composer.click();
      await composer.fill("/");
      await page.waitForTimeout(600);
    }

    const inboxScreenshotPath = path.join(ARTIFACTS_DIR, "inbox_chat_polished.png");
    await page.screenshot({ path: inboxScreenshotPath, fullPage: false });
    console.log(`[Capture] Saved: ${inboxScreenshotPath}`);

    // Clear composer
    if (await composer.isVisible()) {
      await composer.fill("");
    }

    // 2. CAPTURE CAMPAIGNS UI WITH CADENCE PRESETS & MATURATION CARD
    console.log("[Capture] Loading Campaigns...");
    await page.goto(`http://127.0.0.1:${PORT}/campaigns`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    // Switch to Histórico tab to show ChipMaturationCard
    const histTab = page.locator("button:has-text('Histórico')").first();
    if (await histTab.isVisible()) {
      await histTab.click();
      await page.waitForTimeout(800);
    }

    // Expand maturation ramp table if button exists
    const rampButton = page.locator("button:has-text('Ver Rampa de Metas')").first();
    if (await rampButton.isVisible()) {
      await rampButton.click();
      await page.waitForTimeout(600);
    }

    const campaignsScreenshotPath = path.join(ARTIFACTS_DIR, "campaigns_cadence_polished.png");
    await page.screenshot({ path: campaignsScreenshotPath, fullPage: false });
    console.log(`[Capture] Saved: ${campaignsScreenshotPath}`);

    // 3. CAPTURE AI & AUTOMATION UNIFIED PAGE (/ai)
    console.log("[Capture] Loading AI Unified Page...");
    await page.goto(`http://127.0.0.1:${PORT}/ai`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    const aiScreenshotPath = path.join(ARTIFACTS_DIR, "ai_unified_page_polished.png");
    await page.screenshot({ path: aiScreenshotPath, fullPage: false });
    console.log(`[Capture] Saved: ${aiScreenshotPath}`);

    // 4. CAPTURE MOBILE NAVIGATION & LAYOUT
    console.log("[Capture] Capturing Mobile Viewport...");
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });

    await mobileContext.addInitScript(({ session, conversations, messages }) => {
      const sessionStr = JSON.stringify(session);
      window.localStorage.setItem("zapai_admin_auth_session", sessionStr);
      window.sessionStorage.setItem("zapai_admin_auth_session", sessionStr);
      window.localStorage.setItem("theme", "dark");
      window.localStorage.setItem("selectedSessionId", "main");
      window.localStorage.setItem("currentSessionId", "main");
      window.localStorage.setItem("activeSessionId", "main");
      window.localStorage.setItem("zapai_inbox_conversations", JSON.stringify(conversations));
      window.localStorage.setItem("zapai_inbox_messages:main:5531988887777", JSON.stringify(messages));
      window.localStorage.setItem("zapai_inbox_messages:main:conv-1", JSON.stringify(messages));
      document.documentElement.classList.add("dark");
    }, seedPayload);

    const mobilePage = await mobileContext.newPage();
    await setupPageRoutes(mobilePage);

    await mobilePage.goto(`http://127.0.0.1:${PORT}/dashboard`, { waitUntil: "networkidle" });
    await mobilePage.waitForTimeout(1500);

    const mobileScreenshotPath = path.join(ARTIFACTS_DIR, "mobile_navigation_polished.png");
    await mobilePage.screenshot({ path: mobileScreenshotPath, fullPage: false });
    console.log(`[Capture] Saved: ${mobileScreenshotPath}`);

    console.log("[Capture] All verification screenshots captured successfully!");
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error("[Capture Error]", err);
  process.exit(1);
});
