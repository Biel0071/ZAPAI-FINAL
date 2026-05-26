import { test, expect, type Locator, type Page } from "@playwright/test";

async function login(page: Page) {
  const response = await page.request.post("http://127.0.0.1:4025/api/auth/login", {
    data: {
      username: "zapadmin",
      password: "zapadmin123",
      tenantId: "default",
    },
    headers: {
      "x-tenant-id": "default",
    },
  });

  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  const token = payload?.token ?? payload?.accessToken ?? payload?.data?.token;
  const expiresAtSeconds = payload?.expiresAt ?? payload?.data?.expiresAt ?? null;

  expect(token).toBeTruthy();

  await page.goto("/login");
  await page.evaluate(({ token: authToken, expiresAt }) => {
    const session = {
      token: authToken,
      username: "zapadmin",
      role: "admin",
      tenantId: "default",
      companyId: "default",
      issuedAt: Date.now(),
      expiresAt: typeof expiresAt === "number" && Number.isFinite(expiresAt)
        ? (expiresAt > 1_000_000_000_000 ? expiresAt : expiresAt * 1000)
        : Date.now() + 1000 * 60 * 60 * 8,
      remember: true,
    };
    localStorage.setItem("zapai_admin_auth_session", JSON.stringify(session));
    window.dispatchEvent(new CustomEvent("zapai-admin-auth-changed"));
  }, { token, expiresAt: expiresAtSeconds });
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/);
}

async function waitForHydration(page: Page, readyLocator: Locator) {
  await page.waitForLoadState("networkidle");
  await expect(page.locator("main")).toBeVisible();
  await expect(readyLocator).toBeVisible();
  await page.waitForTimeout(350);
}

function visualMask(page: Page) {
  return [
    page.locator("main .font-display"),
    page.locator("main .text-2xl"),
    page.locator("main .text-3xl"),
    page.locator("main canvas"),
    page.locator("main svg.recharts-surface"),
  ];
}

async function expectRouteScreenshot(page: Page, name: string) {
  await expect(page.locator("body")).toHaveScreenshot(name, {
    fullPage: true,
    mask: visualMask(page),
  });
}

test.describe("ZapAI CRM UI visual regression", () => {
  test.beforeEach(async ({ page }) => {
    page.on("console", (msg) => {
      console.log(`[BROWSER CONSOLE] [${msg.type()}] ${msg.text()}`);
    });
    page.on("pageerror", (err) => {
      console.error(`[BROWSER ERROR] ${err.name}: ${err.message}\nStack:\n${err.stack}`);
    });
    await login(page);
  });

  test("dashboard visual baseline", async ({ page }) => {
    await page.goto("/dashboard?tab=map");
    await waitForHydration(page, page.locator("main").getByText("Densidade de Leads por Localização"));
    await expect(page.locator("main").getByRole("button", { name: "Resetar" })).toBeVisible();
    await expect(page.locator("main").getByRole("button", { name: "Exportar Dados" })).toBeVisible();
    await expect(page.locator("main").getByRole("button", { name: "Regiões", exact: true })).toBeVisible();
    await expect(page.locator("main").getByRole("button", { name: "Estados", exact: true })).toBeVisible();
    await expect(page.locator("main").getByRole("button", { name: "DDDs", exact: true })).toBeVisible();
    await expect(page.locator("main").getByText("Mapa de Origem dos Clientes por DDD")).toHaveCount(0);
    await expectRouteScreenshot(page, "dashboard-map.png");
  });

  test("inbox visual baseline", async ({ page }) => {
    await page.goto("/inbox");
    await waitForHydration(page, page.getByPlaceholder("Buscar conversas..."));
    await expect(page.locator("main").getByRole("heading", { name: "Inbox" })).toBeVisible();
    await expectRouteScreenshot(page, "inbox.png");
  });

  test("campaigns visual baseline", async ({ page }) => {
    await page.goto("/campaigns");
    await waitForHydration(page, page.locator("main").getByRole("heading", { name: "Campanhas" }));
    await expect(page.locator("main").getByRole("button", { name: "Nova Campanha" })).toBeVisible();
    await expectRouteScreenshot(page, "campaigns.png");
  });

  test("connections visual baseline", async ({ page }) => {
    await page.goto("/connections");
    await waitForHydration(page, page.locator("main").getByRole("heading", { name: "Conexões WhatsApp" }));
    await expect(page.locator("main").getByText("Sessão ativa:")).toBeVisible();
    await expect(page.locator("main").getByRole("button", { name: "Nova Conexão" })).toBeVisible();
    await expectRouteScreenshot(page, "connections.png");
  });

  test("analytics visual baseline", async ({ page }) => {
    await page.goto("/analytics");
    await waitForHydration(page, page.locator("main").getByRole("heading", { name: "Analytics Enterprise" }));
    await expectRouteScreenshot(page, "analytics.png");
  });

  test("contacts visual baseline", async ({ page }) => {
    await page.goto("/contacts");
    await waitForHydration(page, page.locator("main").getByRole("heading", { name: "Leads CRM / Contatos" }));
    await expectRouteScreenshot(page, "contacts.png");
  });

  test("flows visual baseline", async ({ page }) => {
    await page.goto("/flows");
    await waitForHydration(page, page.locator("main").getByRole("heading", { name: "Fluxos de Automação" }));
    await expectRouteScreenshot(page, "flows.png");
  });

  test("ai visual baseline", async ({ page }) => {
    await page.goto("/ai");
    await waitForHydration(page, page.locator("main").getByRole("heading", { name: "Configuração de IA" }));
    await expectRouteScreenshot(page, "ai.png");
  });

  test("settings visual baseline", async ({ page }) => {
    await page.goto("/settings");
    await waitForHydration(page, page.locator("main").getByRole("heading", { name: "Configurações" }));
    await expectRouteScreenshot(page, "settings.png");
  });
});
