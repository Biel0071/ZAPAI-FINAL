import { test, expect, type Page, type Request, type Response } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../..");

function isDestructiveButton(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  const destructiveWords = [
    "delete", "remove", "exclude", "destroy", "deletar", "excluir", "apagar", 
    "remover", "sair", "logout", "signout", "reset", "clear", "limpar", "desconectar", "bloquear"
  ];
  return destructiveWords.some(word => normalized.includes(word));
}

function getSafeSlug(route: string): string {
  let name = route.replace(/^\//, "").replace(/\//g, "-").replace(/[^a-zA-Z0-9\-]/g, "");
  return name || "dashboard";
}

test.describe("ZapAI CRM Enterprise Complete System Audit Suite", () => {
  const auditData = {
    timestamp: new Date().toISOString(),
    systemStatus: {
      frontendOnline: true,
      backendOnline: true
    },
    routes: [] as any[],
    apis: [] as any[],
    console_errors: [] as any[],
    page_errors: [] as any[],
    buttons_audit: [] as any[],
    security_audit: [] as any[],
    chat_audit: {
      performed: false,
      success: false,
      messagesSent: [] as string[],
      logs: [] as string[]
    }
  };

  test("run enterprise visual, functional, performance, security and chat audit", async ({ page, context }) => {
    test.setTimeout(600_000); // 10 minutes max execution time

    const reportsDir = path.join(rootDir, "reports");
    const screenshotsDir = path.join(reportsDir, "screenshots");
    const buttonsDir = path.join(reportsDir, "buttons");
    const securityDir = path.join(reportsDir, "security");
    const uxDir = path.join(reportsDir, "ux");

    // Ensure all subdirectories exist
    [reportsDir, screenshotsDir, buttonsDir, securityDir, uxDir].forEach(dir => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });

    const requestStartTimes = new Map<Request, number>();

    // 1. Setup Request/Response Network and Console monitoring
    page.on("request", (req) => {
      requestStartTimes.set(req, Date.now());
    });

    page.on("console", (msg) => {
      const type = msg.type();
      const text = msg.text();
      const loc = msg.location();
      auditData.console_errors.push({
        path: page.url().replace("http://localhost:8080", ""),
        type,
        text,
        location: `${loc.url || "unknown"}:${loc.lineNumber || 0}`
      });
    });

    page.on("pageerror", (err) => {
      auditData.page_errors.push({
        path: page.url().replace("http://localhost:8080", ""),
        name: err.name,
        message: err.message,
        stack: err.stack
      });
    });

    page.on("response", async (response) => {
      const url = response.url();
      if (url.includes("/api/") || url.includes("4025") || url.includes("localhost:8080/api")) {
        const req = response.request();
        const method = req.method();
        const status = response.status();
        const startTime = requestStartTimes.get(req);
        const latencyMs = startTime ? Date.now() - startTime : 0;
        let reqPayload = null;
        let resText = null;

        // Try to read request body
        try {
          reqPayload = req.postData();
        } catch {}

        // Try to read response body
        if (status < 500) {
          try {
            resText = await response.text();
          } catch {}
        }

        auditData.apis.push({
          method,
          url: url.replace("http://127.0.0.1:4025", "").replace("http://localhost:4025", ""),
          status,
          latencyMs,
          requestPayload: reqPayload,
          responseBody: resText ? resText.slice(0, 1000) : null
        });
      }
    });

    // 2. Authenticate using ZapAdmin
    console.log("🔑 Authenticating as master admin...");
    try {
      const loginResponse = await page.request.post("http://127.0.0.1:4025/api/auth/login", {
        data: {
          username: "zapadmin",
          password: "zapadmin123",
          tenantId: "default"
        },
        headers: {
          "x-tenant-id": "default"
        },
        timeout: 10000
      });

      expect(loginResponse.ok()).toBeTruthy();
      const payload = await loginResponse.json();
      const token = payload?.token ?? payload?.accessToken ?? payload?.data?.token;
      expect(token).toBeTruthy();

      await page.goto("http://localhost:8080/login");
      await page.evaluate(({ authToken }) => {
        const session = {
          token: authToken,
          username: "zapadmin",
          role: "master",
          tenantId: "default",
          companyId: "default",
          issuedAt: Date.now(),
          expiresAt: Date.now() + 1000 * 60 * 60 * 8,
          remember: true
        };
        localStorage.setItem("zapai_admin_auth_session", JSON.stringify(session));
        window.dispatchEvent(new CustomEvent("zapai-admin-auth-changed"));
      }, { authToken: token });

      await page.goto("http://localhost:8080/dashboard");
      await page.waitForLoadState("networkidle");
      console.log("✅ Logged in successfully.");
    } catch (err: any) {
      console.error("❌ Auth failed:", err.message);
      auditData.systemStatus.backendOnline = false;
      fs.writeFileSync(path.join(reportsDir, "raw-audit-data.json"), JSON.stringify(auditData, null, 2), "utf8");
      throw err;
    }

    // 3. Load Axe-core source code for accessibility audits
    let axeSource = "";
    try {
      const axePath = path.join(rootDir, "node_modules", "axe-core", "axe.min.js");
      axeSource = fs.readFileSync(axePath, "utf8");
      console.log("♿ Axe-core loaded successfully.");
    } catch (err: any) {
      console.warn("⚠️ Axe-core source file could not be read:", err.message);
    }

    // 4. Define routes queue
    const initialRoutes = [
      "/dashboard",
      "/inbox",
      "/connections",
      "/contacts",
      "/flows",
      "/ai",
      "/analytics",
      "/campaigns",
      "/memory",
      "/users",
      "/nodes",
      "/deployments",
      "/logs",
      "/diagnostics",
      "/settings"
    ];

    const queue = [...initialRoutes];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentRoute = queue.shift()!;
      if (visited.has(currentRoute)) continue;
      visited.add(currentRoute);

      console.log(`🔍 Auditing route: ${currentRoute}`);
      const routeStartTime = Date.now();
      const slug = getSafeSlug(currentRoute);
      
      try {
        const response = await page.goto(`http://localhost:8080${currentRoute}`, {
          waitUntil: "networkidle",
          timeout: 20000
        });

        const loadTimeMs = Date.now() - routeStartTime;
        const finalUrl = page.url();
        const finalRoute = finalUrl.replace("http://localhost:8080", "");
        
        let redirectedTo = null;
        let isBroken = false;
        let errorMsg = null;

        if (finalRoute !== currentRoute && !finalRoute.startsWith(currentRoute + "/")) {
          redirectedTo = finalRoute;
        }

        if (response && response.status() >= 400) {
          isBroken = true;
          errorMsg = `HTTP ${response.status()}`;
        }

        const title = await page.title();

        // 5. Multi-viewport Screenshots
        const viewports = [
          { name: "desktop", width: 1600, height: 900 },
          { name: "mobile", width: 375, height: 812 },
          { name: "tablet", width: 768, height: 1024 },
          { name: "ultrawide", width: 2560, height: 1080 }
        ];

        const responsivenessResults = {} as any;

        for (const vp of viewports) {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          await page.waitForTimeout(300);

          // Take fold screenshot
          const foldPath = path.join(screenshotsDir, `${slug}-${vp.name}-fold.png`);
          await page.screenshot({ path: foldPath, fullPage: false });

          // Take full page screenshot
          const fullPath = path.join(screenshotsDir, `${slug}-${vp.name}-full.png`);
          await page.screenshot({ path: fullPath, fullPage: true });

          // Measure layout overflow
          const overflowX = await page.evaluate(() => {
            return document.documentElement.scrollWidth > window.innerWidth;
          });
          const overflowXAmount = overflowX
            ? await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
            : 0;

          responsivenessResults[vp.name] = {
            healthy: !overflowX,
            overflowAmount: overflowXAmount,
            screenshotFold: `/reports/screenshots/${slug}-${vp.name}-fold.png`,
            screenshotFull: `/reports/screenshots/${slug}-${vp.name}-full.png`
          };
        }

        // Reset to desktop viewport
        await page.setViewportSize({ width: 1600, height: 900 });

        // 6. Security Auditor (Sensitive data leakage scan)
        const securityFindings = await page.evaluate(() => {
          const findings = [] as any[];
          const bodyText = document.body.innerText;
          const htmlContent = document.documentElement.innerHTML;

          // Scanning for raw credentials
          const rawPhones = bodyText.match(/\b(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\s?\d{4}[-\s]?\d{4}|\d{4}[-\s]?\d{4})\b/g);
          if (rawPhones) {
            rawPhones.forEach(phone => {
              findings.push({
                type: "Exposed Phone Number",
                detail: `Phone number found in text content: ${phone}`,
                severity: "low"
              });
            });
          }

          // Scanning for raw Bearer tokens or Session keys in HTML
          if (htmlContent.includes("Bearer ") || htmlContent.match(/eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/)) {
            findings.push({
              type: "Bearer JWT Token Leak",
              detail: "Detected JWT-like token signature in page HTML markup",
              severity: "critical"
            });
          }

          // Localstorage scan
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i) || "";
            const value = localStorage.getItem(key) || "";
            if (key.includes("token") || key.includes("session") || key.includes("auth")) {
              findings.push({
                type: "Auth State in LocalStorage",
                detail: `LocalStorage key '${key}' holds sensitive session data`,
                severity: "medium"
              });
            }
          }

          return findings;
        });

        securityFindings.forEach((finding: any) => {
          auditData.security_audit.push({
            path: currentRoute,
            ...finding
          });
        });

        // 7. Visual UX overlap checker
        const uxOverlaps = await page.evaluate(() => {
          const overlaps = [] as any[];
          const tags = Array.from(document.querySelectorAll("h1, h2, h3, h4, p, span, button, input, a"));
          const visible = tags.filter(el => {
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity || "1") > 0;
          });

          for (let i = 0; i < Math.min(visible.length, 80); i++) {
            const rectA = visible[i].getBoundingClientRect();
            if (rectA.width === 0 || rectA.height === 0) continue;

            for (let j = i + 1; j < Math.min(visible.length, 80); j++) {
              const rectB = visible[j].getBoundingClientRect();
              if (rectB.width === 0 || rectB.height === 0) continue;

              const hasOverlap = !(
                rectA.right <= rectB.left ||
                rectA.left >= rectB.right ||
                rectA.bottom <= rectB.top ||
                rectA.top >= rectB.bottom
              );

              if (hasOverlap) {
                const textA = (visible[i].textContent || "").trim().slice(0, 30);
                const textB = (visible[j].textContent || "").trim().slice(0, 30);
                overlaps.push({
                  elementA: visible[i].tagName.toLowerCase(),
                  textA,
                  elementB: visible[j].tagName.toLowerCase(),
                  textB,
                  boxA: { x: rectA.left, y: rectA.top, w: rectA.width, h: rectA.height },
                  boxB: { x: rectB.left, y: rectB.top, w: rectB.width, h: rectB.height }
                });
              }
            }
          }
          return overlaps;
        });

        // 8. Accessibility scan (Axe-core)
        let accessibility = { violationsCount: 0, violations: [] };
        if (axeSource) {
          try {
            await page.addScriptTag({ content: axeSource });
            const axeResults = await page.evaluate(async () => {
              // @ts-ignore
              return await window.axe.run({
                runOnly: {
                  type: "tag",
                  values: ["wcag2a", "wcag2aa", "best-practice"]
                }
              });
            });
            accessibility = {
              violationsCount: axeResults.violations.length,
              violations: axeResults.violations.map((v: any) => ({
                id: v.id,
                impact: v.impact,
                description: v.description,
                help: v.help,
                nodesCount: v.nodes.length
              }))
            };
          } catch (e: any) {
            console.warn(`⚠️ Accessibility check failed for ${currentRoute}:`, e.message);
          }
        }

        // 9. Real Message sending test on Inbox page
        if (currentRoute === "/inbox") {
          console.log("💬 Executing real messaging verification test...");
          auditData.chat_audit.performed = true;
          auditData.chat_audit.logs.push("Started Inbox chat message verification.");

          try {
            // Check if there are any conversations
            const chatItems = page.locator(".conversation-item, .chat-item, [role='button']").filter({ hasText: /Contato|31|main|WhatsApp/i });
            const chatCount = await chatItems.count();

            if (chatCount > 0) {
              auditData.chat_audit.logs.push(`Found ${chatCount} conversations in sidebar. Selecting first chat.`);
              await chatItems.first().click({ timeout: 5000 });
              await page.waitForTimeout(1000);
            } else {
              auditData.chat_audit.logs.push("Inbox list empty. Navigating to contacts to open a chat scope.");
              await page.goto("http://localhost:8080/contacts");
              await page.waitForLoadState("networkidle");
              
              // Simulate opening chat scope for a default connection
              await page.evaluate(() => {
                window.localStorage.setItem("zapai_inbox_last_chat_scope", "default:3193672075");
              });
              await page.goto("http://localhost:8080/inbox");
              await page.waitForLoadState("networkidle");
              await page.waitForTimeout(1500);
              auditData.chat_audit.logs.push("Opened fallback chat scope.");
            }

            // Identify input textarea
            const textarea = page.locator("textarea").first();
            if (await textarea.count() > 0 && await textarea.isVisible()) {
              await textarea.focus();
              
              // 1. Send single message
              const msg1 = `QA System Audit: Message 1 (Status validation) - ${Date.now()}`;
              await textarea.fill(msg1);
              auditData.chat_audit.logs.push("Filled first text message.");

              const sendBtn = page.locator("button[aria-label='Enviar mensagem']").first();
              if (await sendBtn.count() > 0 && await sendBtn.isVisible()) {
                await sendBtn.click({ timeout: 3000 });
                auditData.chat_audit.messagesSent.push(msg1);
                auditData.chat_audit.logs.push("Sent Message 1.");
                await page.waitForTimeout(1500);
              }

              // 2. Send multiple messages (burst test)
              const msg2 = `QA System Audit: Message 2 (WebSocket checks) - ${Date.now()}`;
              const msg3 = `QA System Audit: Message 3 (Flow consistency) - ${Date.now()}`;

              await textarea.fill(msg2);
              if (await sendBtn.isVisible()) {
                await sendBtn.click({ timeout: 3000 });
                auditData.chat_audit.messagesSent.push(msg2);
                auditData.chat_audit.logs.push("Sent Message 2.");
                await page.waitForTimeout(1000);
              }

              await textarea.fill(msg3);
              if (await sendBtn.isVisible()) {
                await sendBtn.click({ timeout: 3000 });
                auditData.chat_audit.messagesSent.push(msg3);
                auditData.chat_audit.logs.push("Sent Message 3.");
                await page.waitForTimeout(1500);
              }

              auditData.chat_audit.success = true;
              auditData.chat_audit.logs.push("Sent all burst messages successfully.");
            } else {
              auditData.chat_audit.logs.push("Textarea not visible or not enabled. Inbox in read-only state.");
            }
          } catch (e: any) {
            auditData.chat_audit.logs.push(`Messaging E2E error: ${e.message}`);
            console.error("❌ Messaging verification failed:", e.message);
          }

          // Go back to the crawler view
          await page.goto("http://localhost:8080/inbox");
          await page.waitForLoadState("networkidle");
        }

        // 10. Audit ALL clickable elements on the page (Recursive button clicking loop)
        console.log(`🔘 Auditing interactive elements on ${currentRoute}...`);
        const clickables = await page.evaluate(() => {
          return Array.from(document.querySelectorAll("button, a, [role='button'], [role='tab'], [role='menuitem']")).map((el, idx) => {
            const text = el.textContent || el.getAttribute("aria-label") || el.getAttribute("title") || "";
            return {
              index: idx,
              tag: el.tagName.toLowerCase(),
              text: text.trim().slice(0, 40),
              id: el.id || "",
              className: el.className || "",
              role: el.getAttribute("role") || el.tagName.toLowerCase(),
              isDisabled: (el as any).disabled || el.getAttribute("aria-disabled") === "true"
            };
          });
        });

        let clickedCount = 0;
        const clickedTexts = new Set<string>();

        for (const element of clickables) {
          const destructive = isDestructiveButton(element.text);
          const repetitive = clickedTexts.has(element.text);
          let testResult = "Skipped (destructive/repetitive)";
          let actionDetected = false;

          // Limit button clicking to 8 unique non-destructive elements per page to avoid timeout
          if (!element.isDisabled && !destructive && !repetitive && element.text.length > 0 && clickedCount < 8) {
            clickedTexts.add(element.text);
            clickedCount++;

            try {
              // Take before click screenshot
              const beforeImgFilename = `${slug}-btn${element.index}-before.png`;
              const beforeImgPath = path.join(buttonsDir, beforeImgFilename);
              await page.screenshot({ path: beforeImgPath });

              const locator = page.locator(element.tag).nth(element.index);
              if (await locator.count() > 0 && await locator.first().isVisible()) {
                const urlBefore = page.url();
                const networkCountBefore = auditData.apis.length;
                const consoleCountBefore = auditData.console_errors.length;

                // Click element
                await locator.first().click({ timeout: 1500 });
                await page.waitForTimeout(800);

                const urlAfter = page.url();
                const networkCountAfter = auditData.apis.length;
                const consoleCountAfter = auditData.console_errors.length;

                const urlChanged = urlBefore !== urlAfter;
                const madeNetworkCall = networkCountAfter > networkCountBefore;
                const gotConsoleError = consoleCountAfter > consoleCountBefore;
                const modalVisible = await page.locator("[role='dialog'], .modal, [role='alertdialog']").count() > 0;

                actionDetected = urlChanged || madeNetworkCall || modalVisible || gotConsoleError;
                testResult = urlChanged ? "Navigated" : madeNetworkCall ? "Triggered API" : modalVisible ? "Opened Modal" : gotConsoleError ? "Triggered Console Error" : "Click succeeded (No visible state change)";

                // Take after click screenshot
                const afterImgFilename = `${slug}-btn${element.index}-after.png`;
                const afterImgPath = path.join(buttonsDir, afterImgFilename);
                await page.screenshot({ path: afterImgPath });

                auditData.buttons_audit.push({
                  path: currentRoute,
                  text: element.text,
                  role: element.role,
                  status: "functional",
                  actionDetected,
                  clickResult: testResult,
                  beforeScreenshot: `/reports/buttons/${beforeImgFilename}`,
                  afterScreenshot: `/reports/buttons/${afterImgFilename}`
                });

                // Restore state if navigated
                if (urlChanged) {
                  await page.goto(`http://localhost:8080${currentRoute}`, { waitUntil: "networkidle", timeout: 15000 });
                }
              }
            } catch (err: any) {
              testResult = `Click error: ${err.message}`;
              auditData.buttons_audit.push({
                path: currentRoute,
                text: element.text,
                role: element.role,
                status: "broken",
                actionDetected: false,
                clickResult: testResult,
                beforeScreenshot: `/reports/buttons/${slug}-btn${element.index}-before.png`,
                afterScreenshot: ""
              });
            }
          }
        }

        // 11. Extract internal anchor links to discover new sub-pages
        const links = await page.evaluate(() => {
          return Array.from(document.querySelectorAll("a[href]")).map(a => a.getAttribute("href") || "");
        });

        for (const link of links) {
          if (link.startsWith("/") && !link.startsWith("//") && !link.includes(":")) {
            const clean = link.split("?")[0].split("#")[0];
            if (clean && !visited.has(clean) && !queue.includes(clean) && !initialRoutes.includes(clean)) {
              if (!clean.includes("logout") && !clean.includes("login") && queue.length < 35) {
                queue.push(clean);
              }
            }
          }
        }

        // Append route info
        auditData.routes.push({
          path: currentRoute,
          status: isBroken ? "broken" : redirectedTo ? "redirected" : "ok",
          title,
          redirectedTo,
          error: errorMsg,
          loadTimeMs,
          responsiveness: responsivenessResults,
          uxOverlaps,
          accessibility
        });

      } catch (err: any) {
        console.error(`❌ Error visiting route ${currentRoute}:`, err.message);
        auditData.routes.push({
          path: currentRoute,
          status: "broken",
          title: "",
          redirectedTo: null,
          error: err.message,
          loadTimeMs: 0,
          responsiveness: {},
          uxOverlaps: [],
          accessibility: { violationsCount: 0, violations: [] }
        });
      }
    }

    // Save final raw JSON data
    const finalDataPath = path.join(reportsDir, "raw-audit-data.json");
    fs.writeFileSync(finalDataPath, JSON.stringify(auditData, null, 2), "utf8");
    console.log(`💾 Raw audit data written to ${finalDataPath}`);
  });
});
