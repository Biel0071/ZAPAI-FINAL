const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();
  
  await page.goto("http://localhost/campaigns");
  
  // Login if needed
  if (await page.locator("input[type=\"email\"]").count() > 0) {
    await page.fill("input[type=\"email\"]", "admin@admin.com");
    await page.fill("input[type=\"password\"]", "admin123");
    await page.click("button[type=\"submit\"]");
    await page.waitForTimeout(2000);
    await page.goto("http://localhost/campaigns");
  }

  await page.waitForTimeout(2000);
  
  // Click Criar Campanha
  await page.click("text=Criar Campanha");
  await page.waitForTimeout(1000);
  
  await page.screenshot({ path: "/tmp/ia_mode.png" });
  
  // Switch to Manual
  await page.click("text=Criar Manualmente");
  await page.waitForTimeout(1000);
  
  await page.screenshot({ path: "/tmp/manual_mode.png" });
  
  await browser.close();
})();
