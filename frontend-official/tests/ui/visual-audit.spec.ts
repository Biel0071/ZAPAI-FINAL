import { test, expect, type BrowserContext, type Page, type Route, type Request } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

type AuditRoute = {
  id: string;
  path: string;
  tabText?: string;
  unauthenticated?: boolean;
  fixture?: "avatar-preview" | "evolution-graph" | "evolution-error" | "inbox-conversation";
  interaction?: "open-avatar-editor" | "open-qa-conversation" | "explore-evolution-graph" | "show-evolution-error";
};

const VIEWPORTS = [
  { label: "1440", width: 1440, height: 900 },
  { label: "1024", width: 1024, height: 900 },
  { label: "768", width: 768, height: 1024 },
  { label: "390", width: 390, height: 844 },
] as const;
const THEMES = ["dark", "light"] as const;
const ROUTES: AuditRoute[] = [
  { id: "root-redirect", path: "/" },
  { id: "login", path: "/login", unauthenticated: true },
  { id: "dashboard-overview", path: "/dashboard" },
  { id: "dashboard-map", path: "/dashboard?tab=map" },
  { id: "inbox", path: "/inbox" },
  { id: "inbox-conversation", path: "/inbox", fixture: "inbox-conversation", interaction: "open-qa-conversation" },
  { id: "connections", path: "/connections" },
  { id: "attendants", path: "/attendants" },
  { id: "attendants-avatar-editor", path: "/attendants", fixture: "avatar-preview", interaction: "open-avatar-editor" },
  { id: "attendants-copilot", path: "/attendants?tab=copilot" },
  { id: "attendants-memory", path: "/attendants?tab=memory" },
  { id: "attendants-evolution", path: "/attendants?tab=evolution" },
  { id: "attendants-evolution-data", path: "/attendants?tab=evolution", fixture: "evolution-graph", interaction: "explore-evolution-graph" },
  { id: "attendants-evolution-error", path: "/attendants?tab=evolution", fixture: "evolution-error", interaction: "show-evolution-error" },
  { id: "contacts", path: "/contacts" },
  { id: "ai-agents", path: "/ai?tab=agent" },
  { id: "ai-flows", path: "/ai?tab=flows" },
  { id: "ai-operations", path: "/ai?tab=operations" },
  { id: "ai-evolution", path: "/ai?tab=evolution" },
  { id: "campaigns-compose", path: "/campaigns", tabText: "Novo Disparo" },
  { id: "campaigns-history", path: "/campaigns", tabText: "Histórico" },
  { id: "campaigns-analysis", path: "/campaigns", tabText: "Análise IA" },
  { id: "memory-overview", path: "/memory" },
  { id: "memory-graph", path: "/memory", tabText: "Grafo Ativo de Memória" },
  { id: "memory-evolution", path: "/memory", tabText: "Evolução do Atendente" },
  { id: "memory-contacts", path: "/memory", tabText: "Registros de Contatos" },
  ...["perfil", "empresa", "equipe", "notificacoes", "seguranca", "faturamento", "aparencia", "idioma", "api-keys", "webhooks", "dados"].map((tab) => ({
    id: `settings-${tab}`,
    path: `/settings?tab=${tab}`,
  })),
  ...["queue", "nodes", "users", "deployments", "versions", "logs", "tests", "diagnostics"].map((tab) => ({
    id: `admin-${tab}`,
    path: `/settings?tab=${tab}`,
  })),
  { id: "admin-node-details", path: "/nodes/visual-audit-fixture" },
];

function auditPageReady() {
  const loadingMarkers = ["Carregando Módulo", "Sincronizando Dados", "Inicializando ZAI Engine"];
  const visibleLoadingFallback = Array.from(document.querySelectorAll("body *")).some((element) => {
    if (element.children.length > 0 || !loadingMarkers.some((marker) => element.textContent?.trim().includes(marker))) return false;
    const style = window.getComputedStyle(element);
    return element.getClientRects().length > 0 && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
  });
  const hasPageRegion = Array.from(document.querySelectorAll("main,[role=main],h1"))
    .some((element) => element.getClientRects().length > 0);
  return hasPageRegion && !visibleLoadingFallback;
}

const EMPTY_API_RESPONSE = {
  success: true,
  data: [],
  agents: [],
  conversations: [],
  messages: [],
  contacts: [],
  sessions: [],
  stores: [],
  items: [],
  pending: [],
  patterns: [],
  memories: [],
  nodes: [],
  edges: [],
  graph: { nodes: [], edges: [] },
  metrics: {},
  stats: {},
};

const AVATAR_AUDIT_AGENT = {
  key: "qa-visual-audit",
  name: "Perfil de Auditoria",
  role: "Atendimento",
  active: true,
  avatarConfig: {
    agentId: "qa-visual-audit",
    body: "female",
    base: "female",
    skin: "peach",
    hair: "female_ponytail_brunette",
    hairColor: "dark_brown",
    face: "face_friendly_smile",
    outfit: "blazer_emerald_trim",
    clothing: "blazer_emerald_trim",
    accessories: ["headset_zai_green", "badge_zai_lanyard"],
    style: "style_vendas",
    catalogSpriteId: "sprite_r2_c1",
  },
};

const EVOLUTION_AUDIT_GRAPH = {
  nodes: [
    { id: "qa-agent", type: "agent", label: "Perfil de Auditoria" },
    { id: "qa-contact", type: "contact", label: "Contato de QA" },
    {
      id: "qa-preference",
      type: "preference",
      label: "Preferência QA",
    },
    { id: "qa-product", type: "product", label: "Produto QA" },
  ],
  edges: [
    { source: "qa-agent", target: "qa-contact", relation: "atende" },
    { source: "qa-contact", target: "qa-preference", relation: "prefere" },
    { source: "qa-preference", target: "qa-product", relation: "relacionada" },
  ],
};

const INBOX_AUDIT_CONVERSATION = {
  id: "qa-conversation-001",
  chatId: "qa-contact@s.whatsapp.net",
  contactName: "Contato de QA",
  phone: "+5500000000000",
  sessionId: "qa-session",
  last_message: "Mensagem segura de QA",
  updated_at: "2026-10-13T12:00:00.000Z",
  unread_count: 1,
  status: "online",
};

const INBOX_AUDIT_MESSAGES = [
  {
    id: "qa-message-001",
    conversationId: "qa-conversation-001",
    text: "Mensagem segura de QA",
    fromMe: false,
    createdAt: "2026-10-13T12:00:00.000Z",
    timestamp: "2026-10-13T12:00:00.000Z",
  },
];

async function fulfillJson(route: Route, request: Request, payload: unknown, status = 200) {
  const origin = request.headers().origin;
  return route.fulfill({
    status,
    contentType: "application/json",
    headers: origin ? {
      "access-control-allow-origin": origin,
      "access-control-allow-credentials": "true",
    } : undefined,
    body: JSON.stringify(payload),
  });
}

async function installReadOnlyMocks(context: BrowserContext, fixture?: AuditRoute["fixture"]) {
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isLocalApp = ["http://localhost:8080", "http://127.0.0.1:8080", "http://127.0.0.1:4025", "http://localhost:4025"].includes(url.origin);
    const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
    if (isFont) return route.continue();
    const isBackendPath = /^\/(api|auth|health|metrics|media|send-message|send-media|upload|uploads|session|sessions|session-status|status-whatsapp|socket\.io)(\/|$)/.test(url.pathname);
    if (!isBackendPath) return isLocalApp ? route.continue() : route.abort();

    if (request.method() === "OPTIONS") {
      const origin = request.headers().origin;
      return route.fulfill({
        status: 204,
        headers: {
          ...(origin ? { "access-control-allow-origin": origin, "access-control-allow-credentials": "true" } : {}),
          "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
          "access-control-allow-headers": request.headers()["access-control-request-headers"] || "authorization,content-type",
        },
      });
    }

    const harmlessAuditPost = request.method() === "POST" && (
      url.pathname.endsWith("/api/sessions/recover")
      || url.pathname.endsWith("/api/system/error-log")
      || url.pathname.endsWith("/api/leads/temperature")
      || url.pathname.endsWith("/api/ai/analyze-conversation")
      || /^\/api\/conversations\/[^/]+\/read$/.test(url.pathname)
      || (fixture === "inbox-conversation" && url.pathname.endsWith("/api/ai/compose"))
    );
    if (harmlessAuditPost || (fixture === "inbox-conversation" && request.method() === "POST" && url.pathname.endsWith("/api/conversations/qa-conversation-001/sync-history"))) {
      return fulfillJson(route, request, url.pathname.endsWith("/api/ai/analyze-conversation") ? { success: true, data: {} } : { success: true, recovered: [] });
    }
    if (request.method() !== "GET" && request.method() !== "HEAD") return route.abort();

    if (fixture === "avatar-preview" && request.method() === "GET" && url.pathname.endsWith("/config/ai-agents")) {
      return fulfillJson(route, request, { success: true, agents: [AVATAR_AUDIT_AGENT] });
    }

    if ((fixture === "evolution-graph" || fixture === "evolution-error") && request.method() === "GET") {
      if (url.pathname.endsWith("/config/ai-agents")) {
        return fulfillJson(route, request, { success: true, agents: [AVATAR_AUDIT_AGENT] });
      }
      if (url.pathname.endsWith("/ai/agent-evolution/qa-visual-audit")) {
        return fulfillJson(route, request, { success: true });
      }
      if (url.pathname.endsWith("/ai/agent-learning/qa-visual-audit")) {
        return fulfillJson(route, request, { success: true, pending: [], stats: {} });
      }
      if (url.pathname.endsWith("/ai/agent-evolve/learned-patterns")) {
        return fulfillJson(route, request, { success: true, data: [] });
      }
      if (url.pathname.endsWith("/ai/evolution/agent-level")) {
        return fulfillJson(route, request, { success: true, data: {} });
      }
      if (url.pathname.endsWith("/ai/evolution/suggestions")) {
        return fulfillJson(route, request, { success: true, data: [] });
      }
      if (url.pathname.endsWith("/ai/memory/graph")) {
        return fulfillJson(route, request, fixture === "evolution-error"
          ? { success: false, error: "Falha de leitura de QA" }
          : { success: true, data: EVOLUTION_AUDIT_GRAPH });
      }
    }

    if (request.method() === "GET" && url.pathname.endsWith("/config/ai-agents")) {
      return fulfillJson(route, request, { success: true, agents: [] });
    }

    if (fixture === "inbox-conversation" && request.method() === "GET") {
      if (url.pathname.endsWith("/api/conversations")) {
        return fulfillJson(route, request, [INBOX_AUDIT_CONVERSATION]);
      }
      if (url.pathname.endsWith("/api/sessions/status") || url.pathname.endsWith("/sessions")) {
        return fulfillJson(route, request, { success: true, sessions: [{ id: "qa-session", name: "QA", status: "connected", connected: true }] });
      }
      if (url.pathname.endsWith("/api/conversations/qa-conversation-001/messages")) {
        return fulfillJson(route, request, INBOX_AUDIT_MESSAGES);
      }
    }

    return fulfillJson(route, request, EMPTY_API_RESPONSE);
  });
}

async function openAuditRoute(page: Page, baseURL: string, route: AuditRoute, viewport: typeof VIEWPORTS[number]) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(new URL(route.path, baseURL).toString(), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(auditPageReady, undefined, { timeout: 60_000 }).catch(() => undefined);

  let tabSelected = true;
  if (route.tabText) {
    const tab = page.getByRole("tab", { name: new RegExp(route.tabText, "i") }).first();
    try {
      await tab.waitFor({ state: "visible", timeout: 15_000 });
      await tab.click({ timeout: 5_000 });
      await expect(tab).toHaveAttribute("aria-selected", "true", { timeout: 5_000 });
    } catch {
      tabSelected = false;
    }
  }
  return tabSelected;
}

async function captureState(page: Page, viewport: typeof VIEWPORTS[number], tabSelected: boolean) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.querySelectorAll("main").forEach((main) => main.scrollTo(0, 0));
  });
  await page.waitForFunction(auditPageReady, undefined, { timeout: 10_000 }).catch(() => undefined);
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.addStyleTag({
    content: "*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important;caret-color:transparent!important}",
  }).catch(() => undefined);

  const metrics = await page.evaluate(() => {
    const documentWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0);
    const visibleMainLandmarks = Array.from(document.querySelectorAll("main,[role=main]")).filter((element) => element.getClientRects().length > 0).length;
    const rootTextLength = document.querySelector("#root")?.textContent?.trim().length || 0;
    const loadingMarkers = ["Carregando Módulo", "Sincronizando Dados", "Inicializando ZAI Engine"];
    const appFallbackVisible = Array.from(document.querySelectorAll("body *")).some((element) => {
      if (element.children.length > 0 || !loadingMarkers.some((marker) => element.textContent?.trim().includes(marker))) return false;
      const style = window.getComputedStyle(element);
      return element.getClientRects().length > 0 && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
    });
    return {
      viewportWidth: window.innerWidth,
      documentWidth,
      horizontalOverflow: documentWidth > window.innerWidth + 2,
      documentHeight: Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0),
      visibleHeadings: Array.from(document.querySelectorAll("h1")).filter((element) => element.getClientRects().length > 0).length,
      mainLandmarks: document.querySelectorAll("main,[role=main]").length,
      appContentRendered: (visibleMainLandmarks > 0 || Array.from(document.querySelectorAll("h1")).some((element) => element.getClientRects().length > 0) || rootTextLength > 120)
        && !appFallbackVisible,
      appFallbackVisible,
      focusableControls: document.querySelectorAll("a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex='0']").length,
      failedImages: Array.from(document.images).filter((image) => image.complete && image.naturalWidth === 0).length,
      finalPath: `${window.location.pathname}${window.location.search}`,
    };
  });

  return {
    metrics,
    tabSelected,
    screenshot: await page.screenshot({ type: "jpeg", quality: 60, animations: "disabled" }),
  };
}

async function buildContactSheet(
  routeId: string,
  fixtureLabel: string,
  captures: Array<{ label: string; screenshot: Buffer }>,
  outputPath: string,
) {
  const tileWidth = 420;
  const tileImageHeight = 236;
  const tileHeaderHeight = 28;
  const tileHeight = tileImageHeight + tileHeaderHeight;
  const columns = 4;
  const sheetHeaderHeight = 42;
  const sheetWidth = tileWidth * columns;
  const sheetHeight = sheetHeaderHeight + tileHeight * 2;
  const tiles = await Promise.all(captures.map(async ({ label, screenshot }) => {
    const image = await sharp(screenshot)
      .resize(tileWidth, tileImageHeight, { fit: "contain", background: "#080d17" })
      .jpeg({ quality: 62 })
      .toBuffer();
    const header = Buffer.from(`<svg width="${tileWidth}" height="${tileHeaderHeight}"><rect width="100%" height="100%" fill="#111827"/><text x="12" y="19" fill="#d5dee9" font-family="Arial" font-size="12">${label}</text></svg>`);
    return sharp({ create: { width: tileWidth, height: tileHeight, channels: 3, background: "#080d17" } })
      .composite([{ input: header, top: 0, left: 0 }, { input: image, top: tileHeaderHeight, left: 0 }])
      .png()
      .toBuffer();
  }));

  const title = Buffer.from(`<svg width="${sheetWidth}" height="${sheetHeaderHeight}"><rect width="100%" height="100%" fill="#080d17"/><text x="14" y="26" fill="#e2e8f0" font-family="Arial" font-size="16">${routeId} · ${fixtureLabel} · captura sanitizada</text></svg>`);
  await sharp({ create: { width: sheetWidth, height: sheetHeight, channels: 3, background: "#080d17" } })
    .composite([
      { input: title, top: 0, left: 0 },
      ...tiles.map((input, index) => ({
        input,
        top: sheetHeaderHeight + Math.floor(index / columns) * tileHeight,
        left: (index % columns) * tileWidth,
      })),
    ])
    .webp({ quality: 72 })
    .toFile(outputPath);
}

test("captures every canonical route, tab, theme, and viewport with sanitized read-only fixtures", async ({ browser, baseURL }) => {
  test.setTimeout(15 * 60 * 1000);
  expect(baseURL).toBeTruthy();

  const setName = process.env.VISUAL_AUDIT_SET || "baseline";
  if (!/^(baseline|after)$/.test(setName)) throw new Error("VISUAL_AUDIT_SET must be baseline or after");
  const routeFilter = process.env.VISUAL_AUDIT_ROUTE_FILTER;
  const routeIds = routeFilter?.split(",").map((routeId) => routeId.trim()).filter(Boolean);
  const routesToCapture = routeIds?.length ? ROUTES.filter((route) => routeIds.includes(route.id)) : ROUTES;
  if (routesToCapture.length === 0) throw new Error(`Unknown visual audit route: ${routeFilter}`);

  const outputDir = path.resolve(process.cwd(), "docs", "visual-evidence", setName);
  await fs.mkdir(outputDir, { recursive: true });
  const authState = path.resolve(__dirname, "..", ".auth", "user.json");
  const audit = {
    capturedAt: new Date().toISOString(),
    fixture: "sanitized-read-only",
    viewports: VIEWPORTS,
    themes: THEMES,
    routeCount: routesToCapture.length,
    routes: [] as Array<Record<string, unknown>>,
  };

  for (const route of routesToCapture) {
    const captures: Array<{ label: string; screenshot: Buffer }> = [];
    const routeStates: Array<Record<string, unknown>> = [];

    for (const theme of THEMES) {
      const context = route.unauthenticated
        ? await browser.newContext({ storageState: { cookies: [], origins: [] }, colorScheme: theme })
        : await browser.newContext({ storageState: authState, colorScheme: theme });
      await context.addInitScript((selectedTheme) => {
        localStorage.setItem("zapai_theme", selectedTheme);
      }, theme);
      await installReadOnlyMocks(context, route.fixture);
      const page = await context.newPage();
      let pageErrors = 0;
      const failedApiRequests: string[] = [];
      page.on("pageerror", () => { pageErrors += 1; });
      page.on("requestfailed", (request) => {
        const failedUrl = new URL(request.url());
        if (/^\/(api|auth|health|metrics|media|session|sessions|session-status|status-whatsapp|socket\.io)(\/|$)/.test(failedUrl.pathname)) {
          const safePath = failedUrl.pathname.replace(/(conversations|messages|ai-agents)\/[^/]+/g, "$1/:id");
          failedApiRequests.push(`${request.method()} ${safePath}: ${request.failure()?.errorText || "request failed"}`);
        }
      });
      const tabSelected = await openAuditRoute(page, baseURL!, route, VIEWPORTS[0]);
      if (route.id === "root-redirect") {
        await expect.poll(() => new URL(page.url()).pathname, { timeout: 60_000 }).toBe("/dashboard");
      }
      if (route.id === "login") {
        expect(new URL(page.url()).pathname).toBe("/login");
      }
      if (route.id === "ai-agents") {
        await expect(page.getByText("Falha ao carregar atendentes", { exact: true })).toHaveCount(0);
      }
      if (route.id === "ai-flows") {
        await expect(page.getByText(/Objeção de Preço/i)).toHaveCount(0);
        await expect(page.getByText("Nenhum playbook cadastrado", { exact: true })).toBeVisible();
      }
      if (route.id === "admin-tests") {
        await expect(page.getByText("Taxa de Sucesso", { exact: true }).locator("..")).toContainText("—");
      }
      if (route.interaction === "open-avatar-editor") {
        await page.getByRole("button", { name: /Estúdio Avançado/i }).click({ timeout: 10_000 });
        const dialog = page.getByRole("dialog");
        await dialog.getByText("ZAI Avatar Studio").waitFor({ state: "visible", timeout: 10_000 });
        await expect(dialog.getByRole("img", { name: "Perfil de Auditoria" })).toBeVisible();
        await dialog.getByRole("button", { name: "Alternar para prévia por camadas" }).click();
        const layeredAvatar = dialog.locator('svg[viewBox="0 0 100 160"]');
        await expect(layeredAvatar).toBeVisible();
        await dialog.getByRole("button", { name: "Alternar para ilustração detalhada" }).click();
        await page.getByRole("tab", { name: /Cabelo/i }).click();
        await dialog.locator('[data-avatar-item="hair_03"]').first().click();
        const avatarPreview = dialog.getByRole("img", { name: "Perfil de Auditoria" });
        await expect(avatarPreview).toHaveAttribute("src", /sprite_r2_c3_clean\.png$/);
        await expect(avatarPreview).toHaveAttribute("data-avatar-preview-focal-x", "73");
        await avatarPreview.evaluate((image: HTMLImageElement) => image.decode());
        if (process.env.VISUAL_AUDIT_RAW === "1") {
          await fs.writeFile(path.join(outputDir, `attendants-avatar-variant-hair03-${theme}-1440.jpg`), await page.screenshot({ type: "jpeg", quality: 75, animations: "disabled" }));
        }
        await dialog.getByRole("button", { name: "Alternar para prévia por camadas" }).click();
        await expect(layeredAvatar).toBeVisible();
        await expect(layeredAvatar.locator('#layer-hair [fill="#eab308"]').first()).toBeVisible();
        if (process.env.VISUAL_AUDIT_RAW === "1") {
          await fs.writeFile(path.join(outputDir, `attendants-avatar-variant-hair03-layers-${theme}-1440.jpg`), await page.screenshot({ type: "jpeg", quality: 75, animations: "disabled" }));
        }
        await dialog.getByRole("button", { name: "Alternar para ilustração detalhada" }).click();
        await dialog.locator('[data-avatar-item="hair_01"]').first().click();
        await expect(dialog.getByRole("img", { name: "Perfil de Auditoria" })).toHaveAttribute("src", /sprite_r2_c1_clean\.png$/);
        const hairTab = page.getByRole("tab", { name: /Cabelo/i });
        await hairTab.focus();
        await page.keyboard.press("ArrowRight");
        await expect(page.getByRole("tab", { name: /Rosto/i })).toHaveAttribute("aria-selected", "true");
        await page.getByRole("tab", { name: /Corpo/i }).click();
      } else if (route.interaction === "open-qa-conversation") {
        await page.getByText("Contato de QA", { exact: false }).first().click({ timeout: 10_000 });
        await page.getByText("Mensagem segura de QA", { exact: false }).last().waitFor({ state: "visible", timeout: 10_000 });
      } else if (route.interaction === "explore-evolution-graph") {
        await page.getByRole("button", { name: /Preferências\s*\d*/i }).first().click({ timeout: 10_000 });
        const memoryNode = page.getByRole("button", { name: "Selecionar memória: Preferência QA" });
        await memoryNode.waitFor({ state: "visible", timeout: 10_000 });
        await memoryNode.focus();
        await page.keyboard.press("Enter");
        const details = page.getByRole("complementary", { name: "Detalhes da Memória" });
        await expect(details).toContainText("Preferência QA");
        await expect(details).toContainText("Assertividade —");
        await expect(details).toContainText("Resumo");
        await expect(details).not.toContainText("Exemplo de Conversa");
        await expect(details).not.toContainText("Observações & Fatos Aprendidos");
      } else if (route.interaction === "show-evolution-error") {
        const error = page.getByRole("alert");
        await expect(error).toContainText("Não foi possível carregar as memórias");
        await expect(page.getByText("PIX com 5% de Desconto")).toHaveCount(0);
        await error.scrollIntoViewIfNeeded();
      }

      for (const viewport of VIEWPORTS) {
        const errorsBeforeCapture = pageErrors;
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        if (route.interaction === "explore-evolution-graph") {
          const details = page.getByRole("complementary", { name: "Detalhes da Memória" });
          await page.waitForFunction(() => {
            const graph = document.querySelector('[data-testid="active-brain-graph"]');
            const svg = graph?.querySelector(":scope > svg");
            return Boolean(graph && svg && Math.abs(svg.viewBox.baseVal.width - graph.offsetWidth) < 2);
          }, undefined, { timeout: 5_000 });
          const summary = details.getByText("Resumo", { exact: true });
          await summary.evaluate((element) => element.scrollIntoView({ block: "center", inline: "nearest" }));
          const summaryFitsAboveMobileNav = await page.evaluate(() => {
            const panel = document.querySelector('[aria-label="Detalhes da Memória"]');
            const summary = panel && Array.from(panel.querySelectorAll("*")).find((element) => element.textContent?.trim() === "Resumo");
            const summaryRect = summary?.getBoundingClientRect();
            const nav = document.querySelector('nav[aria-label="Navegação móvel"]');
            const navRect = nav?.getBoundingClientRect();
            const visibleNavTop = navRect && navRect.height > 0 ? navRect.top : window.innerHeight;
            return Boolean(summaryRect && summaryRect.top >= 0 && summaryRect.bottom <= visibleNavTop);
          });
          expect(summaryFitsAboveMobileNav, `${viewport.width}px memory details must scroll clear of the mobile navigation`).toBe(true);
          const layout = await page.evaluate(() => {
            const panel = document.querySelector('[aria-label="Detalhes da Memória"]')?.getBoundingClientRect();
            const graphElement = document.querySelector('[data-testid="active-brain-graph"]');
            const graph = graphElement?.getBoundingClientRect();
            const categoryNodes = Array.from(document.querySelectorAll('[data-testid="memory-category-node"]'))
              .map((label) => label.getBoundingClientRect());
            if (!panel || !graph) return { panelsDoNotOverlap: false, detailsVisible: false };
            const overlaps = !(graph.right <= panel.left + 1 || panel.right <= graph.left + 1 || graph.bottom <= panel.top + 1 || panel.bottom <= graph.top + 1);
            return {
              panelsDoNotOverlap: !overlaps,
              detailsVisible: panel.width > 0 && panel.height > 0,
              canvasFitsViewport: graph.left >= 0 && graph.right <= window.innerWidth,
              categoryNodesFit: categoryNodes.length > 0 && categoryNodes.every((rect) => rect.left >= graph.left + 2 && rect.right <= graph.right - 2 && rect.left >= 0 && rect.right <= window.innerWidth),
            };
          });
          expect(layout.panelsDoNotOverlap, `${viewport.width}px evolution graph and details must not overlap`).toBe(true);
          expect(layout.detailsVisible, `${viewport.width}px evolution details must render`).toBe(true);
          expect(layout.canvasFitsViewport, `${viewport.width}px evolution graph canvas must remain inside the viewport`).toBe(true);
          expect(layout.categoryNodesFit, `${viewport.width}px every graph category node and label must remain inside the canvas`).toBe(true);
          if (process.env.VISUAL_AUDIT_RAW === "1") {
            const detailPath = path.join(outputDir, `${route.id}-details-${theme}-${viewport.label}.jpg`);
            await fs.writeFile(detailPath, await page.screenshot({ type: "jpeg", quality: 75, animations: "disabled" }));
          }
        } else if (route.interaction === "show-evolution-error") {
          await page.getByRole("alert").scrollIntoViewIfNeeded();
        }
        const state = await captureState(page, viewport, tabSelected);
        if (route.interaction === "open-avatar-editor") {
          const headerAndTabs = await page.evaluate(() => {
            const dialog = document.querySelector('[role="dialog"]')?.getBoundingClientRect();
            const randomBtn = Array.from(document.querySelectorAll('[role="dialog"] button'))
              .find((button) => button.textContent?.includes("Aleatório"))?.getBoundingClientRect();
            const closeBtn = Array.from(document.querySelectorAll('[role="dialog"] button'))
              .find((button) => button.textContent?.includes("Fechar"))?.getBoundingClientRect();
            const tabs = Array.from(document.querySelectorAll('[role="dialog"] [role="tab"]'))
              .map((tab) => tab.getBoundingClientRect());
            const randomClearsClose = Boolean(
              randomBtn &&
              closeBtn &&
              (randomBtn.right <= closeBtn.left - 2 || randomBtn.top >= closeBtn.bottom + 2 || closeBtn.top >= randomBtn.bottom + 2),
            );
            const allSevenTabsFitDialog = Boolean(
              dialog &&
              tabs.length === 7 &&
              tabs.every((rect) => rect.width > 0 && rect.left >= dialog.left && rect.right <= dialog.right + 1),
            );
            return { randomClearsClose, allSevenTabsFitDialog, tabCount: tabs.length };
          });
          expect(headerAndTabs.randomClearsClose, `${theme} ${viewport.width}px Aleatório button must not overlap the dialog close button`).toBe(true);
          if (viewport.width >= 640) {
            expect(headerAndTabs.allSevenTabsFitDialog, `${theme} ${viewport.width}px all 7 Avatar Studio tabs must fit inside the dialog without clipping`).toBe(true);
          }
        }
        if (route.interaction === "open-avatar-editor" && viewport.width <= 390) {
          const layout = await page.evaluate(() => {
            const dialog = document.querySelector('[role="dialog"]')?.getBoundingClientRect();
            const saveButton = Array.from(document.querySelectorAll('[role="dialog"] button'))
              .find((button) => button.textContent?.includes("Salvar Avatar"))?.getBoundingClientRect();
            return {
              dialogFits: Boolean(dialog && dialog.left >= 0 && dialog.right <= window.innerWidth),
              saveActionVisible: Boolean(saveButton && saveButton.top >= 0 && saveButton.bottom <= window.innerHeight),
            };
          });
          expect(layout.dialogFits, `${theme} avatar editor dialog must fit in the mobile viewport`).toBe(true);
          expect(layout.saveActionVisible, `${theme} avatar save action must remain visible on mobile`).toBe(true);
        }
        const label = `${theme} · ${viewport.label} × ${viewport.height}`;
        captures.push({ label, screenshot: state.screenshot });
        if (process.env.VISUAL_AUDIT_RAW === "1") {
          const rawPath = path.join(outputDir, `${route.id}-${theme}-${viewport.label}.jpg`);
          await fs.writeFile(rawPath, state.screenshot);
        }
        const entry = {
          route: route.id,
          path: route.path,
          theme,
          viewport: viewport.label,
          tabSelected: state.tabSelected,
          pageErrors: pageErrors - errorsBeforeCapture,
          failedApiRequests: [...new Set(failedApiRequests)],
          ...state.metrics,
        };
        routeStates.push(entry);
      }
      await context.close();
    }

    const screenshotPath = path.join(outputDir, `${route.id}.webp`);
    const fixtureLabel = route.fixture ? "dados sintéticos de QA" : "APIs vazias";
    await buildContactSheet(route.id, fixtureLabel, captures, screenshotPath);
    audit.routes.push({
      id: route.id,
      path: route.path,
      fixture: route.fixture ?? "empty-api",
      status: routeStates.every((state) =>
        state.appContentRendered === true
        && state.horizontalOverflow === false
        && state.pageErrors === 0
        && state.failedImages === 0
        && state.tabSelected === true
        && state.failedApiRequests.length === 0
      ) ? "needs-visual-review" : "unrendered",
      screenshot: path.relative(process.cwd(), screenshotPath).replaceAll("\\", "/"),
      states: routeStates,
    });
  }

  await fs.writeFile(path.join(outputDir, "audit.json"), JSON.stringify(audit, null, 2), "utf8");
  const unrenderedRoutes = audit.routes.filter((route) => route.status === "unrendered").map((route) => route.id);
  console.log(`Visual audit captured ${routesToCapture.length} routes into ${path.relative(process.cwd(), outputDir)}. Unrendered: ${unrenderedRoutes.join(", ") || "none"}.`);
  await expect(audit.routes).toHaveLength(routesToCapture.length);
});
