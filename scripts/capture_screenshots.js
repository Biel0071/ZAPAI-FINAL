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

// Rich Mock Data
const MOCK_CONVERSATIONS = [
  {
    id: "conv-1",
    contactName: "Carlos Eduardo - Imobiliária",
    phone: "5511998765432",
    lastMessage: "Excelente! Vou querer agendar a visita amanhã às 14h.",
    updatedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    unread: 2,
    isAI: true,
    aiEnabled: true,
    status: "delivered",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
    tags: ["Cliente VIP", "Imóveis", "Lead Quente"],
    funnel_stage: "Proposta Enviada",
    summary: "Cliente interessado em cobertura duplex no Jardins. Orçamento aprovado até R$ 2.5M. Prefere contato via WhatsApp pela manhã.",
    agent_name: "Corretor Virtual Zai",
    sessionId: "main",
  },
  {
    id: "conv-2",
    contactName: "Mariana Alcantara",
    phone: "5521987654321",
    lastMessage: "Vocês aceitam parcelamento via cartão ou boleto bancário?",
    updatedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    unread: 0,
    isAI: false,
    aiEnabled: false,
    status: "read",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
    tags: ["Dúvida Comercial", "Novo Lead"],
    funnel_stage: "Primeiro Contato",
    summary: "Dúvida sobre formas de pagamento para o plano Enterprise.",
    agent_name: "Suporte Vendas",
    sessionId: "main",
  },
  {
    id: "conv-3",
    contactName: "Dr. Roberto Martins",
    phone: "5531976543210",
    lastMessage: "Perfeito, documento assinado e enviado!",
    updatedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    unread: 0,
    isAI: true,
    aiEnabled: true,
    status: "read",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
    tags: ["Contrato Fechado"],
    funnel_stage: "Cliente Ativo",
    summary: "Contrato anual assinado digitalmente.",
    agent_name: "Onboarding Bot",
    sessionId: "main",
  },
  {
    id: "conv-4",
    contactName: "Fernanda Costa",
    phone: "5541965432109",
    lastMessage: "Obrigada pelo retorno rápido!",
    updatedAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    unread: 0,
    isAI: false,
    aiEnabled: false,
    status: "delivered",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&auto=format&fit=crop&q=80",
    tags: ["Suporte"],
    funnel_stage: "Resolvido",
    summary: "Atendimento de suporte resolvido com sucesso.",
    agent_name: "Atendente Humano",
    sessionId: "main",
  }
];

const MOCK_MESSAGES = [
  {
    id: "msg-1",
    conversationId: "conv-1",
    content: "Olá! Gostaria de receber mais informações sobre o empreendimento Residencial Jardins.",
    fromMe: false,
    createdAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
    status: "read",
    source: "customer",
  },
  {
    id: "msg-2",
    conversationId: "conv-1",
    content: "Olá Carlos! Com certeza, é um prazer atendê-lo. Temos unidades de 120m² a 240m² com 3 suítes e vista panorâmica. Segue o catálogo completo:",
    fromMe: true,
    createdAt: new Date(Date.now() - 38 * 60 * 1000).toISOString(),
    status: "read",
    source: "ai",
  },
  {
    id: "msg-3",
    conversationId: "conv-1",
    content: "Catálogo Residencial Jardins 2026.pdf",
    mediaUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    mediaType: "file",
    fromMe: true,
    createdAt: new Date(Date.now() - 37 * 60 * 1000).toISOString(),
    status: "read",
    source: "ai",
  },
  {
    id: "msg-4",
    conversationId: "conv-1",
    content: "Sensacional! As fotos da varanda gourmet ficaram ótimas.",
    fromMe: false,
    createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    status: "read",
    source: "customer",
  },
  {
    id: "msg-5",
    conversationId: "conv-1",
    content: "Planta baixa decorada",
    mediaUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&auto=format&fit=crop&q=80",
    mediaType: "image",
    fromMe: true,
    createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    status: "read",
    source: "human",
  },
  {
    id: "msg-6",
    conversationId: "conv-1",
    content: "Excelente! Vou querer agendar a visita amanhã às 14h.",
    fromMe: false,
    createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    status: "delivered",
    source: "customer",
  }
];

const MOCK_QUICK_REPLIES = [
  {
    id: "qr-1",
    title: "Saudação Comercial Inicial",
    category: "Atendimento",
    text: "Olá! Seja muito bem-vindo à nossa imobiliária. Como posso te ajudar hoje?",
    favorite: true,
    items: [
      {
        id: "item-1",
        type: "text",
        value: "Olá! Seja muito bem-vindo à nossa imobiliária. Como posso te ajudar hoje?",
        delayMs: 0,
        typingMs: 1200,
      }
    ]
  },
  {
    id: "qr-2",
    title: "Apresentação de Catálogo e Plantas",
    category: "Vendas",
    text: "Veja nosso catálogo com todos os lançamentos de alto padrão deste mês.",
    favorite: true,
    isFlow: true,
    steps: [
      {
        id: "step-1",
        type: "text",
        value: "Perfeito! Segue o material completo que preparei com os empreendimentos selecionados:",
        delayMs: 0,
        typingMs: 1500,
      },
      {
        id: "step-2",
        type: "image",
        value: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&auto=format&fit=crop&q=80",
        filename: "Fachada_Residencial.jpg",
        caption: "Fachada contemporânea com paisagismo assinado.",
        delayMs: 1500,
      },
      {
        id: "step-3",
        type: "file",
        value: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
        filename: "Catalogo_Plantas_Valores_2026.pdf",
        delayMs: 2000,
      }
    ]
  },
  {
    id: "qr-3",
    title: "Agendamento de Visita Presencial",
    category: "Vendas",
    text: "Podemos agendar sua visita para conhecer o decorado amanhã?",
    favorite: false,
    items: [
      {
        id: "item-2",
        type: "text",
        value: "Ótimo! Nosso consultor estará pronto para recebê-lo. Por favor, confirme o horário ideal para você.",
        delayMs: 0,
        typingMs: 1000,
      }
    ]
  },
  {
    id: "qr-4",
    title: "Chave PIX e Dados Bancários",
    category: "Financeiro",
    text: "Dados para transferência e pagamento de sinal de reserva.",
    favorite: false,
    items: [
      {
        id: "item-3",
        type: "text",
        value: "Nossa chave PIX (CNPJ) é 12.345.678/0001-90. Banco Santander, Agência 1234, C/C 56789-0.",
        delayMs: 0,
        typingMs: 800,
      }
    ]
  }
];

const MOCK_AGENTS = [
  { id: "agent-1", name: "Corretor Virtual Zai", active: true },
  { id: "agent-2", name: "Suporte Vendas", active: true },
  { id: "agent-3", name: "Atendente Humano", active: true },
];

async function setupPageRoutes(page) {
  // Handle all API requests
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes("/api/auth/me") || url.includes("/api/auth/session") || url.includes("/api/auth/check")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          authenticated: true,
          user: { username: "admin", role: "admin", name: "Administrador" },
          session: { token: "fake-jwt", username: "admin", role: "admin" }
        })
      });
    }

    if (url.includes("/api/conversations/") && url.includes("/messages")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: MOCK_MESSAGES, messages: MOCK_MESSAGES })
      });
    }

    if (url.includes("/api/conversations/") && url.includes("/avatar")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: { avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80" },
          avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
        })
      });
    }

    if (url.includes("/api/conversations")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: MOCK_CONVERSATIONS, conversations: MOCK_CONVERSATIONS })
      });
    }

    if (url.includes("/api/quick-replies")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: MOCK_QUICK_REPLIES, items: MOCK_QUICK_REPLIES, replies: MOCK_QUICK_REPLIES })
      });
    }

    if (url.includes("/api/agents") || url.includes("/api/ai/agents")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: MOCK_AGENTS, agents: MOCK_AGENTS })
      });
    }

    if (url.includes("/api/sessions/status") || url.includes("/api/sessions") || url.includes("/sessions")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          data: {
            sessions: [
              { id: "main", name: "WhatsApp Comercial Principal", sessionName: "WhatsApp Comercial Principal", status: "online", phone: "5511999990000", connected: true }
            ]
          },
          sessions: [
            { id: "main", name: "WhatsApp Comercial Principal", sessionName: "WhatsApp Comercial Principal", status: "online", phone: "5511999990000", connected: true }
          ]
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
            summary: "Cliente interessado em cobertura duplex no Jardins. Orçamento aprovado até R$ 2.5M. Prefere contato via WhatsApp pela manhã.",
            notes: "Orçamento aprovado. Visita agendada para amanhã."
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
        body: JSON.stringify({ status: "healthy", ok: true })
      });
    }

    // Default mock response
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true })
    });
  });
}

async function run() {
  const server = await startStaticServer();

  console.log("[Playwright] Launching Chromium...");
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    // -------------------------------------------------------------
    // 1. DESKTOP CAPTURES (1440x900)
    // -------------------------------------------------------------
    console.log("[Capture] Desktop 1440x900 Inbox...");
    const desktopContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2, // High-DPI retina screenshot
    });

    const desktopPage = await desktopContext.newPage();
    await setupPageRoutes(desktopPage);

    // Seed auth in localStorage
    await desktopPage.addInitScript(() => {
      localStorage.setItem("zapai_admin_auth_session", JSON.stringify({
        token: "fake-jwt-token-for-visual-testing",
        username: "admin",
        role: "admin",
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

    // Direct store hydration for reliable visual rendering
    await desktopPage.evaluate(({ convs, msgs }) => {
      if (window.useAppStore) {
        window.useAppStore.setState({
          activeSessionId: "main",
          sessions: [
            { id: "main", name: "WhatsApp Comercial Principal", sessionName: "WhatsApp Comercial Principal", status: "online", phone: "5511999990000", connected: true }
          ],
          conversations: convs,
          activeConversationId: "conv-1",
          messagesByConversationId: { "conv-1": msgs }
        });
      }
    }, { convs: MOCK_CONVERSATIONS, msgs: MOCK_MESSAGES });
    await desktopPage.waitForTimeout(1000);

    // Tab 1: Atendimento & Cliente
    const tab1Btn = desktopPage.locator('button[role="tab"]').filter({ hasText: /Atendimento/i });
    if (await tab1Btn.count() > 0) {
      await tab1Btn.click();
      await desktopPage.waitForTimeout(500);
    }
    const tab1Path = path.join(ARTIFACTS_DIR, "screenshot_desktop_inbox_tab1.png");
    await desktopPage.screenshot({ path: tab1Path, fullPage: false });
    console.log(`[Captured] Desktop Tab 1: ${tab1Path}`);

    // Tab 2: Respostas Rápidas
    const tab2Btn = desktopPage.locator('button[role="tab"]').filter({ hasText: /Respostas/i });
    if (await tab2Btn.count() > 0) {
      await tab2Btn.click();
      await desktopPage.waitForTimeout(500);
    }
    const tab2Path = path.join(ARTIFACTS_DIR, "screenshot_desktop_inbox_tab2.png");
    await desktopPage.screenshot({ path: tab2Path, fullPage: false });
    console.log(`[Captured] Desktop Tab 2: ${tab2Path}`);

    // Tab 3: Arquivos
    const tab3Btn = desktopPage.locator('button[role="tab"]').filter({ hasText: /Arquivos/i });
    if (await tab3Btn.count() > 0) {
      await tab3Btn.click();
      await desktopPage.waitForTimeout(500);
    }
    const tab3Path = path.join(ARTIFACTS_DIR, "screenshot_desktop_inbox_tab3.png");
    await desktopPage.screenshot({ path: tab3Path, fullPage: false });
    console.log(`[Captured] Desktop Tab 3: ${tab3Path}`);

    // Tab 4: Logs & Histórico
    const tab4Btn = desktopPage.locator('button[role="tab"]').filter({ hasText: /Logs/i });
    if (await tab4Btn.count() > 0) {
      await tab4Btn.click();
      await desktopPage.waitForTimeout(500);
    }
    const tab4Path = path.join(ARTIFACTS_DIR, "screenshot_desktop_inbox_tab4.png");
    await desktopPage.screenshot({ path: tab4Path, fullPage: false });
    console.log(`[Captured] Desktop Tab 4: ${tab4Path}`);

    // Full HD 1920x1080 capture
    await desktopPage.setViewportSize({ width: 1920, height: 1080 });
    await desktopPage.waitForTimeout(800);
    const hdPath = path.join(ARTIFACTS_DIR, "screenshot_desktop_1080p_inbox.png");
    await desktopPage.screenshot({ path: hdPath, fullPage: false });
    console.log(`[Captured] Desktop 1080p: ${hdPath}`);

    await desktopContext.close();

    // -------------------------------------------------------------
    // 2. MOBILE CAPTURES (390x844 - iPhone / Standard Mobile)
    // -------------------------------------------------------------
    console.log("[Capture] Mobile 390x844...");
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
        token: "fake-jwt-token-for-visual-testing",
        username: "admin",
        role: "admin",
        issuedAt: Date.now(),
        expiresAt: Date.now() + 86400000,
        remember: true,
      }));
      localStorage.setItem("zapai_inbox_active_session", "main");
      localStorage.setItem("zapflow_view_mode", "mobile");
    });

    await mobilePage.goto(`http://127.0.0.1:${PORT}/inbox`, { waitUntil: "networkidle" });
    await mobilePage.waitForTimeout(1000);

    // 2a. Mobile Conversations List Screen (Full screen list, activeConversationId: null)
    await mobilePage.evaluate(({ convs }) => {
      if (window.useAppStore) {
        window.useAppStore.setState({
          activeSessionId: "main",
          sessions: [
            { id: "main", name: "WhatsApp Comercial Principal", sessionName: "WhatsApp Comercial Principal", status: "online", phone: "5511999990000", connected: true }
          ],
          conversations: convs,
          activeConversationId: null,
        });
      }
    }, { convs: MOCK_CONVERSATIONS });
    await mobilePage.waitForTimeout(1000);

    const mobileListPath = path.join(ARTIFACTS_DIR, "screenshot_mobile_conversations_list.png");
    await mobilePage.screenshot({ path: mobileListPath, fullPage: false });
    console.log(`[Captured] Mobile List: ${mobileListPath}`);

    // 2b. Select conversation -> Switch to Active Chat Screen (Full screen chat)
    await mobilePage.evaluate(({ convs, msgs }) => {
      if (window.useAppStore) {
        window.useAppStore.setState({
          conversations: convs,
          activeConversationId: "conv-1",
          messagesByConversationId: { "conv-1": msgs }
        });
      }
    }, { convs: MOCK_CONVERSATIONS, msgs: MOCK_MESSAGES });
    await mobilePage.waitForTimeout(1000);

    const mobileChatPath = path.join(ARTIFACTS_DIR, "screenshot_mobile_chat.png");
    await mobilePage.screenshot({ path: mobileChatPath, fullPage: false });
    console.log(`[Captured] Mobile Chat: ${mobileChatPath}`);

    // 2c. Open Sidebar Drawer on Mobile (via Info/Painel button or Contact click)
    const panelBtn = mobilePage.locator('button[aria-label="Abrir painel da conversa"], button:has-text("Painel")').first();
    if (await panelBtn.count() > 0) {
      await panelBtn.click();
      await mobilePage.waitForTimeout(800);
    } else {
      // Fallback: click contact header
      const contactHeader = mobilePage.locator('div[role="button"][title*="detalhes"]').first();
      if (await contactHeader.count() > 0) {
        await contactHeader.click();
        await mobilePage.waitForTimeout(800);
      }
    }

    // Capture Mobile Drawer Tab 1 (Atendimento)
    const mobileDrawerTab1Path = path.join(ARTIFACTS_DIR, "screenshot_mobile_sidebar_drawer_tab1.png");
    await mobilePage.screenshot({ path: mobileDrawerTab1Path, fullPage: false });
    console.log(`[Captured] Mobile Drawer Tab 1: ${mobileDrawerTab1Path}`);

    // Capture Mobile Drawer Tab 2 (Respostas Rápidas)
    const drawerTab2 = mobilePage.locator('[role="dialog"] button[role="tab"]').filter({ hasText: /Respostas/i });
    if (await drawerTab2.count() > 0) {
      await drawerTab2.click();
      await mobilePage.waitForTimeout(600);
    }
    const mobileDrawerTab2Path = path.join(ARTIFACTS_DIR, "screenshot_mobile_sidebar_drawer_tab2.png");
    await mobilePage.screenshot({ path: mobileDrawerTab2Path, fullPage: false });
    console.log(`[Captured] Mobile Drawer Tab 2: ${mobileDrawerTab2Path}`);

    // Capture Mobile Drawer Tab 3 (Arquivos)
    const drawerTab3 = mobilePage.locator('[role="dialog"] button[role="tab"]').filter({ hasText: /Arquivos/i });
    if (await drawerTab3.count() > 0) {
      await drawerTab3.click();
      await mobilePage.waitForTimeout(600);
    }
    const mobileDrawerTab3Path = path.join(ARTIFACTS_DIR, "screenshot_mobile_sidebar_drawer_tab3.png");
    await mobilePage.screenshot({ path: mobileDrawerTab3Path, fullPage: false });
    console.log(`[Captured] Mobile Drawer Tab 3: ${mobileDrawerTab3Path}`);

    // Capture Mobile Drawer Tab 4 (Logs)
    const drawerTab4 = mobilePage.locator('[role="dialog"] button[role="tab"]').filter({ hasText: /Logs/i });
    if (await drawerTab4.count() > 0) {
      await drawerTab4.click();
      await mobilePage.waitForTimeout(600);
    }
    const mobileDrawerTab4Path = path.join(ARTIFACTS_DIR, "screenshot_mobile_sidebar_drawer_tab4.png");
    await mobilePage.screenshot({ path: mobileDrawerTab4Path, fullPage: false });
    console.log(`[Captured] Mobile Drawer Tab 4: ${mobileDrawerTab4Path}`);

    // 2d. Close Drawer via close button or Escape
    try {
      const closeDrawerBtn = mobilePage.locator('[role="dialog"] button.absolute').first();
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
    console.log("[Capture] Tablet 768x1024...");
    const tabletContext = await browser.newContext({
      viewport: { width: 768, height: 1024 },
      deviceScaleFactor: 2,
    });

    const tabletPage = await tabletContext.newPage();
    await setupPageRoutes(tabletPage);

    await tabletPage.addInitScript(() => {
      localStorage.setItem("zapai_admin_auth_session", JSON.stringify({
        token: "fake-jwt-token-for-visual-testing",
        username: "admin",
        role: "admin",
        issuedAt: Date.now(),
        expiresAt: Date.now() + 86400000,
        remember: true,
      }));
      localStorage.setItem("zapai_inbox_active_session", "main");
      localStorage.setItem("zapflow_view_mode", "auto");
    });

    await tabletPage.goto(`http://127.0.0.1:${PORT}/inbox`, { waitUntil: "networkidle" });
    await tabletPage.waitForTimeout(1000);

    await tabletPage.evaluate(({ convs, msgs }) => {
      if (window.useAppStore) {
        window.useAppStore.setState({
          activeSessionId: "main",
          sessions: [
            { id: "main", name: "WhatsApp Comercial Principal", sessionName: "WhatsApp Comercial Principal", status: "online", phone: "5511999990000", connected: true }
          ],
          conversations: convs,
          activeConversationId: "conv-1",
          messagesByConversationId: { "conv-1": msgs }
        });
      }
    }, { convs: MOCK_CONVERSATIONS, msgs: MOCK_MESSAGES });
    await tabletPage.waitForTimeout(1000);

    const tabletSplitPath = path.join(ARTIFACTS_DIR, "screenshot_tablet_split_view.png");
    await tabletPage.screenshot({ path: tabletSplitPath, fullPage: false });
    console.log(`[Captured] Tablet Split View: ${tabletSplitPath}`);

    // Open tablet drawer
    const tabletPanelBtn = tabletPage.locator('button[aria-label="Abrir painel da conversa"], button:has-text("Painel")').first();
    if (await tabletPanelBtn.count() > 0) {
      await tabletPanelBtn.click();
      await tabletPage.waitForTimeout(800);
    }

    const tabletDrawerPath = path.join(ARTIFACTS_DIR, "screenshot_tablet_sidebar_drawer.png");
    await tabletPage.screenshot({ path: tabletDrawerPath, fullPage: false });
    console.log(`[Captured] Tablet Sidebar Drawer: ${tabletDrawerPath}`);

    await tabletContext.close();

    console.log("[SUCCESS] All screenshots captured successfully in:", ARTIFACTS_DIR);
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((err) => {
  console.error("[FATAL ERROR]", err);
  process.exit(1);
});
