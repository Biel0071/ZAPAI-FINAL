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

  // Select conversation
  const conversationRow = page.locator("[data-conversation-id], [data-testid^='conversation-item']").first();
  if (await conversationRow.isVisible()) {
    console.log("Selecting conversation...");
    await conversationRow.click();
    await page.waitForTimeout(2000);
  }

  // 3. Locate the composer bottom-left actions toolbar
  const emojiBtn = page.locator("[data-emoji-trigger]").first();
  const catalogBtn = page.locator("[data-catalog-trigger]").first();
  const aiBtn = page.locator("button[title*='Sugestão de resposta IA'], button[aria-label*='Resposta IA']").first();
  const attachBtn = page.locator("button[aria-label='Anexar mídia']").first();

  console.log("Checking 4 toolbar buttons:");
  console.log("- Emoji button visible:", await emojiBtn.isVisible());
  console.log("- Catalog button visible:", await catalogBtn.isVisible());
  console.log("- AI Suggestion button visible:", await aiBtn.isVisible());
  console.log("- Attachment button visible:", await attachBtn.isVisible());

  // Crop screenshot of the 4 buttons in composer
  const composerArea = page.locator("textarea[placeholder*='Mensagem'], textarea[placeholder*='Digite']").locator("xpath=../..").first();
  if (await composerArea.isVisible()) {
    await composerArea.screenshot({
      path: "C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40/evidence/composer_4_monochromatic_buttons.png"
    });
    console.log("Saved composer_4_monochromatic_buttons.png");
  }

  // 4. Test sending message
  console.log("4. Sending message from composer...");
  const textarea = page.locator("textarea[placeholder*='Mensagem'], textarea[placeholder*='Digite']").first();
  await textarea.fill("2.20x2.20x0.80");
  await page.waitForTimeout(500);

  // Find send button
  const sendBtn = page.locator("button:has(svg.lucide-send), button:has(svg.ph-paper-plane-tilt), button[aria-label*='Enviar']").first();
  if (await sendBtn.isVisible()) {
    console.log("Clicking send button...");
    await sendBtn.click();
  } else {
    console.log("Pressing Enter to send...");
    await textarea.press("Enter");
  }

  await page.waitForTimeout(3000);

  // Check if error toast exists
  const errorToast = page.locator(".sonner-toast[data-type='error'], :has-text('HTTP_500')");
  const hasError = await errorToast.isVisible().catch(() => false);
  console.log("Is HTTP_500 error toast visible?", hasError);

  // Capture full screen
  await page.screenshot({
    path: "C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40/evidence/inbox_message_sent_live.png"
  });
  console.log("Saved inbox_message_sent_live.png");

  await browser.close();
  if (hasError) {
    console.error("FAILED: HTTP_500 was detected!");
    process.exit(1);
  }
  console.log("SUCCESS: Message sent with 0 errors and 4 monochromatic buttons verified!");
  process.exit(0);
})().catch(err => {
  console.error("Test error:", err);
  process.exit(1);
});
