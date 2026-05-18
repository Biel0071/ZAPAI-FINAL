import { test, expect } from "@playwright/test";

async function login(page: import("@playwright/test").Page) {
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

test.describe("ZapAI CRM UI smoke", () => {
  test("dashboard screen visible after login", async ({ page }) => {
    await login(page);
    await expect(page.getByText("CRM Operacional").first()).toBeVisible();
  });

  test("connections screen visible", async ({ page }) => {
    await login(page);
    await page.goto("/connections");
    await expect(page.getByText("Conexões WhatsApp")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Suas Sessões" })).toBeVisible();
  });

  test("inbox screen visible", async ({ page }) => {
    await login(page);
    await page.goto("/inbox");
    await expect(page.getByText("Inbox")).toBeVisible();
    await expect(page.getByPlaceholder("Buscar conversas...")).toBeVisible();
  });

  test("settings screen visible", async ({ page }) => {
    await login(page);
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Configurações" })).toBeVisible();
  });
});
