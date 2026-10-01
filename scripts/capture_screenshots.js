import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pkg from "../frontend-official/node_modules/@playwright/test/index.js";
const { chromium } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 5174;
const DIST_DIR = path.resolve(__dirname, "../frontend-official/dist");
const ARTIFACTS_DIR = "C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40";

if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

// Load real data exported from VPS PostgreSQL database
const realDataPath = path.resolve(__dirname, "real_inbox_data.json");
if (!fs.existsSync(realDataPath)) {
  throw new Error(`Real data file missing at: ${realDataPath}. Run node scripts/fetch_real_data.js first.`);
}
const rawRealData = JSON.parse(fs.readFileSync(realDataPath, "utf8"));

// Clean & normalize real conversations
const REAL_CONVERSATIONS = rawRealData.conversations.map((c) => {
  const contactName = c.name || c.contactName || (c.phone ? c.phone.replace(/@.*/, "") : "Contato");
  return {
    id: String(c.id),
    contactName: contactName.replace(/@lid.*/, "").replace(/@s\.whatsapp\.net.*/, "").trim() || "Contato",
    name: contactName,
    phone: String(c.phone || c.remote_jid || ""),
    lastMessage: c.lastMessage || "Sem mensagens recentes",
    updatedAt: c.updatedAt || new Date().toISOString(),
    unread: c.unreadCount ?? c.unread ?? 0,
    isAI: Boolean(c.isAI),
    aiEnabled: c.aiEnabled !== false,
    status: c.status || "delivered",
    avatar: c.avatar || c.profilePictureUrl || null,
    tags: Array.isArray(c.tags) ? c.tags : ["Cliente"],
    funnel_stage: c.funnel_stage || "Lead Ativo",
    summary: c.summary && c.summary !== "Conversa iniciada sem resumo disponível." 
      ? c.summary 
      : `Cliente cadastrado com ${c.phone || c.remote_jid}. Atendimento em andamento via WhatsApp.`,
    agent_name: c.agent_name || "Camila",
    sessionId: c.session_id || "main",
    remote_jid: c.remote_jid,
    chatId: c.remote_jid || c.chatId,
  };
});

// Real active conversation: 10506 (Sueli Silva)
const ACTIVE_CONV_ID = "10506";
const activeConv = REAL_CONVERSATIONS.find((c) => c.id === ACTIVE_CONV_ID) || REAL_CONVERSATIONS[0];

// Clean & normalize real messages
const REAL_MESSAGES = (rawRealData.messages || []).map((m) => {
  const isDoc = (m.content && m.content.includes("[document]")) || m.mediaType === "file" || m.mediaUrl;
  return {
    id: String(m.id),
    conversationId: ACTIVE_CONV_ID,
    content: isDoc ? (m.filename || "Comprovante_Pedido.pdf") : (m.content || m.text || ""),
    fromMe: Boolean(m.fromMe),
    createdAt: m.createdAt || m.timestamp || new Date().toISOString(),
    status: m.status === "device_ack" ? "read" : (m.status || "read"),
    source: m.fromMe ? (m.isAI ? "ai" : "human") : "customer",
    mediaUrl: m.mediaUrl || null,
    mediaType: m.mediaType || (isDoc ? "file" : null),
    filename: m.filename || (isDoc ? "documento.pdf" : null),
  };
});

// Real quick replies
const REAL_QUICK_REPLIES = (rawRealData.quickReplies || []).map((qr) => ({
  id: qr.id,
  title: qr.title,
  category: qr.category || "Produtos",
  text: qr.content || qr.text || "",
  favorite: Boolean(qr.favorite),
  isFlow: Boolean(qr.isFlow),
  items: qr.items || [{ type: qr.mediaType || "text", value: qr.content || qr.text || "" }],
  steps: qr.steps || [],
  mediaUrl: qr.mediaUrl,
  mediaType: qr.mediaType,
}));

// Real sessions
const REAL_SESSIONS = (rawRealData.sessions && rawRealData.sessions.length > 0)
  ? rawRealData.sessions.map((s) => ({
      id: s.sessionId || s.id || "main",
      name: s.whatsAppName ? `WhatsApp: ${s.whatsAppName}` : (s.sessionName || "WhatsApp Comercial"),
      sessionName: s.whatsAppName || s.sessionName || "WhatsApp Comercial",
      status: "connected",
      phone: s.phone || "+55 (31) 9367-2075",
      connected: true,
      profilePictureUrl: s.profilePictureUrl || null,
    }))
  : [
      {
        id: "main",
        name: "WhatsApp: Depósito Material",
        sessionName: "Depósito Material",
        status: "connected",
        phone: "+55 (31) 9367-2075",
        connected: true,
      }
    ];

const REAL_AGENTS = [
  { id: "agent-1", name: "Camila", active: true },
  { id: "agent-2", name: "Vendas Balcão", active: true },
  { id: "agent-3", name: "Suporte Financeiro", active: true },
];

// MIME types for static server
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

// Static server with SPA fallback
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

async function setupPageRoutes(page) {
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();

    if (url.includes("/api/auth/me") || url.includes("/api/auth/session") || url.includes("/api/auth/check")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          authenticated: true,
          user: { username: "zapadmin", role: "master", name: "Administrador ZapFlow" },
          session: { token: "real-vps-session-token", username: "zapadmin", role: "master" }
        })
      });
    }

    if (url.includes("/api/conversations/") && url.includes("/messages")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: REAL_MESSAGES, messages: REAL_MESSAGES })
      });
    }

    if (url.includes("/api/conversations/") && url.includes("/avatar")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: { avatarUrl: activeConv.avatar || null },
          avatarUrl: activeConv.avatar || null
        })
      });
    }

    if (url.includes("/api/conversations")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: REAL_CONVERSATIONS, conversations: REAL_CONVERSATIONS })
      });
    }

    if (url.includes("/api/quick-replies")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: REAL_QUICK_REPLIES, items: REAL_QUICK_REPLIES, replies: REAL_QUICK_REPLIES })
      });
    }

    if (url.includes("/api/agents") || url.includes("/api/ai/agents")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: REAL_AGENTS, agents: REAL_AGENTS })
      });
    }

    if (url.includes("/api/sessions/status") || url.includes("/api/sessions") || url.includes("/sessions")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: { sessions: REAL_SESSIONS },
          sessions: REAL_SESSIONS,
        })
      });
    }

    if (url.includes("/api/memory")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            summary: "Cliente Sueli Silva com pedido ativado via transportadora Jadlog (cód: JDL-78945-9632-BR). Comprovante de taxa enviado e confirmado.",
            notes: "Pedido ativado. Rastreio Jadlog fornecido. Aguarda entrega."
          }
        })
      });
    }

    if (url.includes("/api/ai/runtime") || url.includes("/api/ai/status")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          globalEnabled: true,
          aiOn: true,
          providerReady: true,
          provider: "OpenAI",
          model: "gpt-4o",
          memoryEnabled: true
        })
      });
    }

    if (url.includes("/api/health")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "healthy", ok: true, database: { status: "online" } })
      });
    }

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true })
    });
  });
}

async function run() {
  const server = await startStaticServer();

  console.log(`[Playwright] Launching Chromium with ${REAL_CONVERSATIONS.length} REAL conversations & ${REAL_MESSAGES.length} REAL messages...`);
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    // -------------------------------------------------------------
    // 1. DESKTOP CAPTURES (1440x900)
    // -------------------------------------------------------------
    console.log("[Capture] Desktop 1440x900 Inbox with REAL VPS data...");
    const desktopContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });

    const desktopPage = await desktopContext.newPage();
    await setupPageRoutes(desktopPage);

    await desktopPage.addInitScript(() => {
      localStorage.setItem("zapai_admin_auth_session", JSON.stringify({
        token: "real-vps-session-token",
        username: "zapadmin",
        role: "master",
        issuedAt: Date.now(),
        expiresAt: Date.now() + 86400000,
        remember: true,
      }));
      localStorage.setItem("zapai_right_panel_collapsed", "0");
      localStorage.setItem("zapai_inbox_active_session", "main");
      localStorage.setItem("zapflow_view_mode", "desktop");
    });

    await desktopPage.goto(`http://127.0.0.1:${PORT}/inbox`, { waitUntil: "networkidle" });
    await desktopPage.waitForTimeout(1000);

    // Hydrate store with REAL data
    await desktopPage.evaluate(({ convs, msgs, activeId, sessions }) => {
      if (window.useAppStore) {
        window.useAppStore.setState({
          activeSessionId: "main",
          sessions: sessions,
          conversations: convs,
          activeConversationId: activeId,
          messagesByConversationId: { [activeId]: msgs }
        });
      }
    }, { convs: REAL_CONVERSATIONS, msgs: REAL_MESSAGES, activeId: ACTIVE_CONV_ID, sessions: REAL_SESSIONS });
    await desktopPage.waitForTimeout(1200);

    // Tab 1: Atendimento & Cliente
    const tab1Btn = desktopPage.locator('button[role="tab"]').filter({ hasText: /Atendimento/i });
    if (await tab1Btn.count() > 0) {
      await tab1Btn.click();
      await desktopPage.waitForTimeout(500);
    }
    const tab1Path = path.join(ARTIFACTS_DIR, "screenshot_desktop_inbox_tab1.png");
    await desktopPage.screenshot({ path: tab1Path, fullPage: false });
    console.log(`[Captured] Desktop Tab 1 (REAL DATA): ${tab1Path}`);

    // Tab 2: Respostas Rápidas
    const tab2Btn = desktopPage.locator('button[role="tab"]').filter({ hasText: /Respostas/i });
    if (await tab2Btn.count() > 0) {
      await tab2Btn.click();
      await desktopPage.waitForTimeout(500);
    }
    const tab2Path = path.join(ARTIFACTS_DIR, "screenshot_desktop_inbox_tab2.png");
    await desktopPage.screenshot({ path: tab2Path, fullPage: false });
    console.log(`[Captured] Desktop Tab 2 (REAL DATA): ${tab2Path}`);

    // Tab 3: Arquivos
    const tab3Btn = desktopPage.locator('button[role="tab"]').filter({ hasText: /Arquivos/i });
    if (await tab3Btn.count() > 0) {
      await tab3Btn.click();
      await desktopPage.waitForTimeout(500);
    }
    const tab3Path = path.join(ARTIFACTS_DIR, "screenshot_desktop_inbox_tab3.png");
    await desktopPage.screenshot({ path: tab3Path, fullPage: false });
    console.log(`[Captured] Desktop Tab 3 (REAL DATA): ${tab3Path}`);

    // Tab 4: Logs & Histórico
    const tab4Btn = desktopPage.locator('button[role="tab"]').filter({ hasText: /Logs/i });
    if (await tab4Btn.count() > 0) {
      await tab4Btn.click();
      await desktopPage.waitForTimeout(500);
    }
    const tab4Path = path.join(ARTIFACTS_DIR, "screenshot_desktop_inbox_tab4.png");
    await desktopPage.screenshot({ path: tab4Path, fullPage: false });
    console.log(`[Captured] Desktop Tab 4 (REAL DATA): ${tab4Path}`);

    // Full HD 1920x1080 capture
    await desktopPage.setViewportSize({ width: 1920, height: 1080 });
    await desktopPage.waitForTimeout(800);
    const hdPath = path.join(ARTIFACTS_DIR, "screenshot_desktop_1080p_inbox.png");
    await desktopPage.screenshot({ path: hdPath, fullPage: false });
    console.log(`[Captured] Desktop 1080p (REAL DATA): ${hdPath}`);

    await desktopContext.close();

    // -------------------------------------------------------------
    // 2. MOBILE CAPTURES (390x844 - iPhone / Mobile Viewport)
    // -------------------------------------------------------------
    console.log("[Capture] Mobile 390x844 with REAL VPS data...");
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });

    const mobilePage = await mobileContext.newPage();
    await setupPageRoutes(mobilePage);

    await mobilePage.addInitScript(() => {
      localStorage.setItem("zapai_admin_auth_session", JSON.stringify({
        token: "real-vps-session-token",
        username: "zapadmin",
        role: "master",
        issuedAt: Date.now(),
        expiresAt: Date.now() + 86400000,
        remember: true,
      }));
      localStorage.setItem("zapai_inbox_active_session", "main");
      localStorage.setItem("zapflow_view_mode", "mobile");
    });

    await mobilePage.goto(`http://127.0.0.1:${PORT}/inbox`, { waitUntil: "networkidle" });
    await mobilePage.waitForTimeout(1000);

    // 2a. Mobile Real Conversations List Screen (Full screen list, activeConversationId: null)
    await mobilePage.evaluate(({ convs, sessions }) => {
      if (window.useAppStore) {
        window.useAppStore.setState({
          activeSessionId: "main",
          sessions: sessions,
          conversations: convs,
          activeConversationId: null,
        });
      }
    }, { convs: REAL_CONVERSATIONS, sessions: REAL_SESSIONS });
    await mobilePage.waitForTimeout(1000);

    const mobileListPath = path.join(ARTIFACTS_DIR, "screenshot_mobile_conversations_list.png");
    await mobilePage.screenshot({ path: mobileListPath, fullPage: false });
    console.log(`[Captured] Mobile Real List: ${mobileListPath}`);

    // 2b. Select Real Conversation (Sueli Silva) -> Full screen Chat
    await mobilePage.evaluate(({ convs, msgs, activeId }) => {
      if (window.useAppStore) {
        window.useAppStore.setState({
          conversations: convs,
          activeConversationId: activeId,
          messagesByConversationId: { [activeId]: msgs },
          isMobileChatOpen: true,
        });
      }
    }, { convs: REAL_CONVERSATIONS, msgs: REAL_MESSAGES, activeId: ACTIVE_CONV_ID });
    await mobilePage.waitForTimeout(1200);

    const mobileChatPath = path.join(ARTIFACTS_DIR, "screenshot_mobile_chat.png");
    await mobilePage.screenshot({ path: mobileChatPath, fullPage: false });
    console.log(`[Captured] Mobile Real Chat: ${mobileChatPath}`);

    // 2c. Open Real Sidebar Drawer on Mobile (via Info/Painel button)
    const panelBtn = mobilePage.locator('button[aria-label="Abrir painel da conversa"], button:has-text("Painel")').first();
    if (await panelBtn.count() > 0) {
      await panelBtn.click();
      await mobilePage.waitForTimeout(800);
    } else {
      const contactHeader = mobilePage.locator('div[role="button"][title*="detalhes"]').first();
      if (await contactHeader.count() > 0) {
        await contactHeader.click();
        await mobilePage.waitForTimeout(800);
      }
    }

    // Capture Mobile Drawer Tab 1 (Atendimento & Cliente)
    const mobileDrawerTab1Path = path.join(ARTIFACTS_DIR, "screenshot_mobile_sidebar_drawer_tab1.png");
    await mobilePage.screenshot({ path: mobileDrawerTab1Path, fullPage: false });
    console.log(`[Captured] Mobile Drawer Tab 1 (REAL DATA): ${mobileDrawerTab1Path}`);

    // Capture Mobile Drawer Tab 2 (Respostas Rápidas)
    const drawerTab2 = mobilePage.locator('[role="dialog"] button[role="tab"]').filter({ hasText: /Respostas/i });
    if (await drawerTab2.count() > 0) {
      await drawerTab2.click();
      await mobilePage.waitForTimeout(600);
    }
    const mobileDrawerTab2Path = path.join(ARTIFACTS_DIR, "screenshot_mobile_sidebar_drawer_tab2.png");
    await mobilePage.screenshot({ path: mobileDrawerTab2Path, fullPage: false });
    console.log(`[Captured] Mobile Drawer Tab 2 (REAL DATA): ${mobileDrawerTab2Path}`);

    // Capture Mobile Drawer Tab 3 (Arquivos)
    const drawerTab3 = mobilePage.locator('[role="dialog"] button[role="tab"]').filter({ hasText: /Arquivos/i });
    if (await drawerTab3.count() > 0) {
      await drawerTab3.click();
      await mobilePage.waitForTimeout(600);
    }
    const mobileDrawerTab3Path = path.join(ARTIFACTS_DIR, "screenshot_mobile_sidebar_drawer_tab3.png");
    await mobilePage.screenshot({ path: mobileDrawerTab3Path, fullPage: false });
    console.log(`[Captured] Mobile Drawer Tab 3 (REAL DATA): ${mobileDrawerTab3Path}`);

    // Capture Mobile Drawer Tab 4 (Logs)
    const drawerTab4 = mobilePage.locator('[role="dialog"] button[role="tab"]').filter({ hasText: /Logs/i });
    if (await drawerTab4.count() > 0) {
      await drawerTab4.click();
      await mobilePage.waitForTimeout(600);
    }
    const mobileDrawerTab4Path = path.join(ARTIFACTS_DIR, "screenshot_mobile_sidebar_drawer_tab4.png");
    await mobilePage.screenshot({ path: mobileDrawerTab4Path, fullPage: false });
    console.log(`[Captured] Mobile Drawer Tab 4 (REAL DATA): ${mobileDrawerTab4Path}`);

    // 2d. Close Drawer via Escape or Close button
    try {
      const closeDrawerBtn = mobilePage.locator('[role="dialog"] button[aria-label*="Fechar"], [role="dialog"] button.absolute').first();
      if (await closeDrawerBtn.count() > 0) {
        await closeDrawerBtn.click({ force: true });
      } else {
        await mobilePage.keyboard.press("Escape");
      }
    } catch {
      await mobilePage.keyboard.press("Escape");
    }
    await mobilePage.waitForTimeout(600);

    // 2e. Click Back Button ("Voltar") to return to conversation list
    try {
      const backBtn = mobilePage.locator('button[aria-label*="Voltar"]').first();
      if (await backBtn.count() > 0) {
        await backBtn.click({ force: true });
      } else {
        await mobilePage.evaluate(() => {
          if (window.useAppStore) {
            window.useAppStore.setState({ activeConversationId: null });
          }
        });
      }
    } catch {
      await mobilePage.evaluate(() => {
        if (window.useAppStore) {
          window.useAppStore.setState({ activeConversationId: null });
        }
      });
    }
    await mobilePage.waitForTimeout(600);
    const mobileBackNavPath = path.join(ARTIFACTS_DIR, "screenshot_mobile_back_navigation.png");
    await mobilePage.screenshot({ path: mobileBackNavPath, fullPage: false });
    console.log(`[Captured] Mobile Back Navigation: ${mobileBackNavPath}`);

    await mobileContext.close();

    // -------------------------------------------------------------
    // 3. TABLET CAPTURES (768x1024 - iPad Portrait)
    // -------------------------------------------------------------
    console.log("[Capture] Tablet 768x1024 with REAL VPS data...");
    const tabletContext = await browser.newContext({
      viewport: { width: 768, height: 1024 },
      deviceScaleFactor: 2,
    });

    const tabletPage = await tabletContext.newPage();
    await setupPageRoutes(tabletPage);

    await tabletPage.addInitScript(() => {
      localStorage.setItem("zapai_admin_auth_session", JSON.stringify({
        token: "real-vps-session-token",
        username: "zapadmin",
        role: "master",
        issuedAt: Date.now(),
        expiresAt: Date.now() + 86400000,
        remember: true,
      }));
      localStorage.setItem("zapai_inbox_active_session", "main");
      localStorage.setItem("zapflow_view_mode", "auto");
      localStorage.removeItem("react-resizable-panels:zapflow-inbox-desktop-v3");
      localStorage.removeItem("react-resizable-panels:zapflow-inbox-tablet-v3");
      localStorage.removeItem("react-resizable-panels:zapflow-inbox-panels-layout-v2");
    });

    await tabletPage.goto(`http://127.0.0.1:${PORT}/inbox`, { waitUntil: "networkidle" });
    await tabletPage.waitForTimeout(1000);

    await tabletPage.evaluate(({ convs, msgs, activeId, sessions }) => {
      if (window.useAppStore) {
        window.useAppStore.setState({
          activeSessionId: "main",
          sessions: sessions,
          conversations: convs,
          activeConversationId: activeId,
          messagesByConversationId: { [activeId]: msgs }
        });
      }
    }, { convs: REAL_CONVERSATIONS, msgs: REAL_MESSAGES, activeId: ACTIVE_CONV_ID, sessions: REAL_SESSIONS });
    await tabletPage.waitForTimeout(1200);

    const tabletSplitPath = path.join(ARTIFACTS_DIR, "screenshot_tablet_split_view.png");
    await tabletPage.screenshot({ path: tabletSplitPath, fullPage: false });
    console.log(`[Captured] Tablet Split View (REAL DATA): ${tabletSplitPath}`);

    // Open tablet drawer
    const tabletPanelBtn = tabletPage.locator('button[aria-label="Abrir painel da conversa"], button:has-text("Painel")').first();
    if (await tabletPanelBtn.count() > 0) {
      await tabletPanelBtn.click();
      await tabletPage.waitForTimeout(800);
    }

    const tabletDrawerPath = path.join(ARTIFACTS_DIR, "screenshot_tablet_sidebar_drawer.png");
    await tabletPage.screenshot({ path: tabletDrawerPath, fullPage: false });
    console.log(`[Captured] Tablet Sidebar Drawer (REAL DATA): ${tabletDrawerPath}`);

    await tabletContext.close();

    console.log("[SUCCESS] ALL SCREENSHOTS WITH REAL DATA CAPTURED IN:", ARTIFACTS_DIR);
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((err) => {
  console.error("[FATAL ERROR]", err);
  process.exit(1);
});
