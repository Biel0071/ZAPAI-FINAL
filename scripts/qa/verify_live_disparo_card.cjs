const { chromium } = require('../../frontend-official/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--ignore-certificate-errors", "--no-sandbox"] });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log("1. Logging into ZAPAI CRM...");
  await page.goto("https://209.50.241.22:1000/login");
  await page.waitForSelector("#login-username");
  await page.fill("#login-username", "zapadmin");
  await page.fill("#login-password", "zapadmin1010");
  await Promise.all([page.waitForNavigation().catch(()=>{}), page.click("button[type=submit]")]);
  await page.waitForTimeout(3000);

  console.log("2. Navigating to /inbox...");
  await page.goto("https://209.50.241.22:1000/inbox");
  await page.waitForTimeout(4000);

  // Click on the first conversation or search for contact
  const conversationRow = page.locator("[data-conversation-id], [data-testid^='conversation-item']").first();
  if (await conversationRow.isVisible()) {
    console.log("Selecting conversation...");
    await conversationRow.click();
    await page.waitForTimeout(1500);
  }

  // Look for Disparos button in header
  const disparoButton = page.locator("button:has-text('Disparos')").first();
  if (await disparoButton.isVisible()) {
    console.log("Clicking Disparos button in chat header...");
    await disparoButton.click();
    await page.waitForTimeout(1000);

    // Capture screenshot of the Pop-up de Disparos
    await page.screenshot({ path: "C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40/evidence/popup_disparos_open.png" });
    console.log("Saved popup_disparos_open.png");

    // Click Disparar Agora
    const dispararAgoraBtn = page.locator("button:has-text('Disparar Agora')").first();
    if (await dispararAgoraBtn.isVisible()) {
      console.log("Clicking Disparar Agora...");
      await dispararAgoraBtn.click();
      await page.waitForTimeout(2000);
    }
  }

  // Now check if disparo card or message appears in the chat stream
  await page.waitForTimeout(2000);
  const disparoCard = page.locator("[data-testid='disparo-data-card']").first();
  const isCardVisible = await disparoCard.isVisible().catch(() => false);
  console.log("Is Disparo Card visible in central chat pane?", isCardVisible);

  await page.screenshot({ path: "C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40/evidence/inbox_disparo_card_live_verified.png" });
  console.log("Saved inbox_disparo_card_live_verified.png");

  await browser.close();
  process.exit(0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
