import { test, expect } from "@playwright/test";

test.describe("ZapAI CRM UI smoke", () => {
  test("create WhatsApp session view and QR lifecycle entry point", async ({ page }) => {
    await page.goto("/connections");
    await expect(page.getByText("Conexões WhatsApp")).toBeVisible();
    await page.getByRole("button", { name: "Activate WhatsApp" }).first().click();
    await expect(page.getByText("Conectar WhatsApp")).toBeVisible();
  });

  test("delete session action is available", async ({ page }) => {
    await page.goto("/connections");
    await expect(page.getByText("Suas Sessões")).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete" }).first()).toBeVisible();
  });

  test("send message composer visible", async ({ page }) => {
    await page.goto("/inbox");
    await expect(page.getByText("Inbox")).toBeVisible();
    await expect(page.getByRole("button", { name: "Enviar mensagem" })).toBeVisible();
  });

  test("campaign screen visible", async ({ page }) => {
    await page.goto("/campaigns");
    await expect(page.getByText("Campanhas")).toBeVisible();
  });
});
