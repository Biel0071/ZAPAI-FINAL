const { chromium } = require('../../frontend-official/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--ignore-certificate-errors", "--no-sandbox"] });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto("https://209.50.241.22:1000/login");
  await page.waitForSelector("#login-username");
  await page.fill("#login-username", "zapadmin");
  await page.fill("#login-password", "zapadmin1010");
  await Promise.all([page.waitForNavigation().catch(()=>{}), page.click("button[type=submit]")]);
  await page.waitForTimeout(3000);
  await page.goto("https://209.50.241.22:1000/inbox");
  await page.waitForTimeout(4000);
  await page.click("[data-catalog-trigger]");
  await page.waitForTimeout(1000);
  
  // Scroll down to middle
  const scrollContainer = page.locator("[data-catalog-popover] [data-radix-scroll-area-viewport]").first();
  if (await scrollContainer.isVisible()) {
    await scrollContainer.evaluate(el => el.scrollTop = el.scrollHeight / 2);
    await page.waitForTimeout(500);
    await page.screenshot({ path: "C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40/evidence/catalog_popover_scrolled_middle.png" });

    // Scroll to bottom
    await scrollContainer.evaluate(el => el.scrollTop = el.scrollHeight);
    await page.waitForTimeout(500);
    await page.screenshot({ path: "C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40/evidence/catalog_popover_scrolled_bottom.png" });
    console.log("Scrolled screenshots saved successfully!");
  }
  await browser.close();
})().catch(console.error);
