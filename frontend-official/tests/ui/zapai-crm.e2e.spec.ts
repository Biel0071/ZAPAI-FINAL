import { test, expect } from "@playwright/test";

const TEST_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ6YXBhZG1pbiIsInVzZXJuYW1lIjoiemFwYWRtaW4iLCJ0ZW5hbnRJZCI6ImRlZmF1bHQiLCJjb21wYW55SWQiOiJkZWZhdWx0Iiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzc4Nzk5MzMzLCJleHAiOjE3Nzg4MjgxMzN9.L8U7e11dnb1rKF01O91uTcQCwQSkOWtaOhIv5xTK5k4";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.evaluate((token) => {
    const session = {
      token,
      username: "zapadmin",
      role: "admin",
      issuedAt: Date.now(),
      expiresAt: Date.now() + 1000 * 60 * 60 * 8,
      remember: true,
    };
    localStorage.setItem("zapai_admin_auth_session", JSON.stringify(session));
    window.dispatchEvent(new CustomEvent("zapai-admin-auth-changed"));
  }, TEST_TOKEN);
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
