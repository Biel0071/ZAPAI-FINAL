import { test, expect, type Page } from "@playwright/test";

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

test.describe("Diagnose Inbox Send", () => {
  test.beforeEach(async ({ page }) => {
    page.on("console", (msg) => {
      console.log(`[BROWSER CONSOLE] [${msg.type()}] ${msg.text()}`);
    });
    page.on("pageerror", (err) => {
      console.error(`[BROWSER ERROR] ${err.name}: ${err.message}\nStack:\n${err.stack}`);
    });
    page.on("response", async (response) => {
      if (response.url().includes("/send-message")) {
        console.log(`[SEND MESSAGE RESPONSE] Status: ${response.status()}`);
        try {
          const body = await response.json();
          console.log(`[SEND MESSAGE RESPONSE BODY] ${JSON.stringify(body)}`);
        } catch (e) {
          try {
            console.log(`[SEND MESSAGE RESPONSE BODY] Text: ${await response.text()}`);
          } catch (textErr) {
            console.log(`[SEND MESSAGE RESPONSE BODY] Could not read response text`);
          }
        }
      }
    });
    await login(page);
  });

  test("Send message and check for issues", async ({ page }) => {
    console.log("Navigating to /inbox...");
    await page.goto("/inbox");
    await page.waitForLoadState("networkidle");

    console.log("Waiting for conversations...");
    const row = page.locator("button.inbox-message").first();
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.click();
    console.log("Clicked conversation row.");

    await page.waitForTimeout(1000);

    const composer = page.locator("textarea, input[type='text']").first();
    await expect(composer).toBeVisible();
    await composer.fill("Hello, this is a test message from diagnostic test!");
    console.log("Filled composer input.");

    const sendButton = page.locator('button[aria-label="Enviar mensagem"]');
    await expect(sendButton).toBeVisible();
    console.log("Clicking send button...");
    await sendButton.click();
    console.log("Clicked send button. Waiting 5 seconds to observe results...");
    await page.waitForTimeout(5000);
    console.log("Finished waiting.");
  });
});
