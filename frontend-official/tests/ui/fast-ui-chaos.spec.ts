import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

test.describe.configure({ mode: 'parallel' });

// We test these core routes concurrently.
const CORE_ROUTES = [
  "/",
  "/inbox",
  "/contacts",
  "/campaigns",
  "/connections",
  "/settings",
  "/flows",
  "/analytics",
  "/memory"
];

// Directory for historical test data
const historyDir = path.join(process.cwd(), "tests", "history");

test.describe("Enterprise UI Flash Chaos Testing", () => {
  // Ensure history directory exists
  test.beforeAll(() => {
    if (!fs.existsSync(historyDir)) {
      fs.mkdirSync(historyDir, { recursive: true });
    }
  });

  for (const route of CORE_ROUTES) {
    test(`Chaos Map & Stress: ${route}`, async ({ page }) => {
      // 1. Network bypass: Block slow/non-essential resources to speed up rendering
      await page.route('**/*', (route) => {
        const type = route.request().resourceType();
        if (['image', 'font', 'stylesheet', 'media'].includes(type)) {
          // Allow local assets, block external ones like Google Fonts
          if (route.request().url().includes('fonts.googleapis.com')) {
            route.abort();
            return;
          }
        }
        route.continue();
      });

      const errors: string[] = [];
      const interactions: string[] = [];

      page.on("pageerror", err => errors.push(`[JS_EXCEPTION] ${err.message}`));
      page.on("console", msg => {
        if (msg.type() === "error") errors.push(`[CONSOLE_ERROR] ${msg.text()}`);
      });

      // 2. Navigate to route
      const startTime = Date.now();
      await page.goto(route);
      
      // Wait for UI to settle (max 3 seconds)
      await page.waitForLoadState('domcontentloaded');
      try {
        await page.waitForSelector('main, .main-content, #root', { timeout: 3000 });
      } catch (e) {
        // Ignore timeout
      }

      // 3. Extract all buttons and inputs
      const buttons = await page.$$('button, [role="button"], a');
      const inputs = await page.$$('input, textarea, select');
      
      interactions.push(`Found ${buttons.length} buttons/links and ${inputs.length} inputs.`);

      // 4. Chaos Fuzzing
      // Fill random data in a few inputs
      for (const input of inputs.slice(0, 3)) { // Limit to 3 inputs for speed
        try {
          const type = await input.getAttribute('type');
          if (type !== 'hidden' && type !== 'file') {
            await input.fill(`CHAOS_${crypto.randomBytes(4).toString('hex')}`);
            interactions.push(`Fuzzed input`);
          }
        } catch(e) {}
      }

      // Randomly double click some non-destructive buttons
      let clicked = 0;
      for (const btn of buttons) {
        if (clicked >= 5) break; // Limit to 5 clicks per page for speed
        
        try {
          const textContent = await btn.textContent();
          const text = (textContent || '').toLowerCase();
          const isDestructive = ['delete', 'remove', 'logout', 'sair', 'apagar'].some(w => text.includes(w));
          
          if (!isDestructive && await btn.isVisible() && await btn.isEnabled()) {
            await btn.click({ clickCount: 2, force: true }); // Double click to simulate spam
            interactions.push(`Spam clicked: ${text.trim().substring(0, 20)}`);
            clicked++;
          }
        } catch(e) {}
      }

      const duration = Date.now() - startTime;

      // 5. Generate Route Report
      const report = {
        route,
        durationMs: duration,
        buttonCount: buttons.length,
        inputCount: inputs.length,
        errors,
        interactions
      };

      const safeRouteName = route === "/" ? "dashboard" : route.replace(/\//g, "-").replace(/^-/, "");
      fs.writeFileSync(
        path.join(historyDir, `chaos-${safeRouteName}-${Date.now()}.json`),
        JSON.stringify(report, null, 2)
      );

      // We expect NO Javascript exceptions during the chaos fuzzing
      const exceptions = errors.filter(e => e.includes("[JS_EXCEPTION]"));
      expect(exceptions.length, `Exceptions found on ${route}: ${exceptions.join(', ')}`).toBe(0);
    });
  }
});
