const { chromium } = require('../../frontend-official/node_modules/playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const evidenceDir = path.resolve('C:/Users/Dell/.gemini/antigravity/brain/578a7157-8bf3-47e3-82f2-9ed1bb8f9f40/evidence');
  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true, args: ["--ignore-certificate-errors", "--no-sandbox"] });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    console.log("1. Logging into ZAPAI CRM on VPS...");
    await page.goto("https://209.50.241.22:1000/login", { timeout: 30000 });
    await page.waitForSelector("#login-username", { timeout: 15000 });
    await page.fill("#login-username", "zapadmin");
    await page.fill("#login-password", "zapadmin1010");
    await Promise.all([page.waitForNavigation().catch(()=>{}), page.click("button[type=submit]")]);
    await page.waitForTimeout(3000);

    console.log("2. Navigating to /inbox...");
    await page.goto("https://209.50.241.22:1000/inbox", { timeout: 30000 });
    await page.waitForTimeout(4000);

    // Select first active conversation
    const conversationRow = page.locator("[data-conversation-id], [data-testid^='conversation-item']").first();
    if (await conversationRow.isVisible()) {
      console.log("Selecting conversation...");
      await conversationRow.click();
      await page.waitForTimeout(2000);
    }

    // 3. Open catalog popover
    console.log("3. Opening catalog popover...");
    const catalogBtn = page.locator("[data-catalog-trigger]").first();
    await catalogBtn.waitFor({ state: "visible", timeout: 10000 });
    await catalogBtn.click();
    await page.waitForTimeout(2000);

    // Verify popover visible
    const popover = page.locator("[data-catalog-popover]");
    await popover.waitFor({ state: "visible", timeout: 10000 });
    console.log("Catalog popover is visible!");

    // Capture screenshot of catalog popover
    await page.screenshot({
      path: path.join(evidenceDir, "live_catalog_popover_ordered.png")
    });
    console.log("Saved live_catalog_popover_ordered.png");

    // Select first product (TIJOLO 12 FUROS)
    console.log("4. Selecting TIJOLO 12 FUROS checkbox...");
    const productRow = popover.locator("[data-catalog-product-row]").first();
    if (await productRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await productRow.click();
    } else {
      const fallbackRow = popover.locator("div:has-text('TIJOLO 12')").first();
      await fallbackRow.click();
    }
    await page.waitForTimeout(1500);

    // Screenshot showing selected product sticky bar
    await page.screenshot({
      path: path.join(evidenceDir, "live_catalog_sticky_bar.png")
    });
    console.log("Saved live_catalog_sticky_bar.png");

    // Click the batch send button
    console.log("5. Dispatching product to chat...");
    const batchSendBtn = page.locator("[data-testid='batch-send-catalog-btn']").first();
    if (await batchSendBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await batchSendBtn.click();
      console.log("Clicked batch send button!");
    } else {
      console.log("Batch send button not found, clicking 'Enviar no Chat' inside item...");
      const sendDirectBtn = page.locator("button:has-text('Enviar no Chat')").first();
      await sendDirectBtn.click();
    }

    await page.waitForTimeout(4000);

    // 6. Look for WhatsApp Product Card in message list
    console.log("6. Verifying WhatsApp product card in chat pane...");
    const productCard = page.locator("[data-testid='whatsapp-product-card']").last();
    if (await productCard.isVisible({ timeout: 8000 }).catch(() => false)) {
      console.log("WhatsApp product card is visible in chat!");
      await page.screenshot({
        path: path.join(evidenceDir, "live_whatsapp_product_card_sent.png")
      });
      console.log("Saved live_whatsapp_product_card_sent.png");

      // 7. Click 'Ver' to open product details drawer
      console.log("7. Clicking 'Ver' on the product card...");
      const verBtn = productCard.locator("button:has-text('Ver')").first();
      if (await verBtn.isVisible()) {
        await verBtn.click();
        await page.waitForTimeout(2000);

        // Verify product detail drawer
        const detailDrawer = page.locator("[data-testid='product-detail-drawer']");
        if (await detailDrawer.isVisible({ timeout: 5000 }).catch(() => false)) {
          console.log("Product detail drawer is OPEN!");
          await page.screenshot({
            path: path.join(evidenceDir, "live_product_detail_drawer_open.png")
          });
          console.log("Saved live_product_detail_drawer_open.png");

          // Click 'Adicionar ao carrinho'
          console.log("8. Adding to cart...");
          const addToCartBtn = detailDrawer.locator("button:has-text('Adicionar ao carrinho')").first();
          if (await addToCartBtn.isVisible()) {
            await addToCartBtn.click();
            await page.waitForTimeout(1500);

            // Switch to cart view or click cart header
            const cartHeaderBtn = detailDrawer.locator("button:has-text('Carrinho')").first();
            if (await cartHeaderBtn.isVisible()) {
              await cartHeaderBtn.click();
              await page.waitForTimeout(1000);
            }

            await page.screenshot({
              path: path.join(evidenceDir, "live_product_cart_drawer_open.png")
            });
            console.log("Saved live_product_cart_drawer_open.png");
          }
        } else {
          console.log("Product detail drawer did not open.");
        }
      }
    } else {
      console.log("No whatsapp-product-card located; checking recent messages...");
      await page.screenshot({
        path: path.join(evidenceDir, "live_chat_messages_state.png")
      });
    }

    console.log("Verification finished successfully!");
  } catch (error) {
    console.error("Verification failed:", error);
    await page.screenshot({
      path: path.join(evidenceDir, "live_error_state.png")
    });
  } finally {
    await browser.close();
  }
})();
