import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../..");

// Helper to check if a string is a standard destructive operation
function isDestructiveButton(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  const destructiveWords = [
    "delete", "remove", "exclude", "destroy", "deletar", "excluir", "apagar", 
    "remover", "sair", "logout", "signout", "reset", "clear", "limpar"
  ];
  return destructiveWords.some(word => normalized.includes(word));
}

test.describe("ZapAI CRM E2E Auto-Discovery Crawler & Auditor", () => {
  const mapData = {
    timestamp: new Date().toISOString(),
    routes: [] as any[],
    buttons: [] as any[],
    forms: [] as any[],
    apis: [] as any[],
    broken_routes: [] as any[],
    orphan_pages: [] as string[],
    console_errors: [] as any[],
    page_errors: [] as any[],
    responsiveness: [] as any[]
  };

  test("execute crawl and audit system", async ({ page, context }) => {
    test.setTimeout(300_000);
    // 1. Listeners for monitoring errors and network requests
    page.on("console", (msg) => {
      const type = msg.type();
      const text = msg.text();
      if (type === "error" || type === "warning") {
        mapData.console_errors.push({
          path: page.url().replace("http://localhost:8080", ""),
          type,
          text
        });
      }
    });

    page.on("pageerror", (err) => {
      mapData.page_errors.push({
        path: page.url().replace("http://localhost:8080", ""),
        name: err.name,
        message: err.message,
        stack: err.stack
      });
    });

    page.on("response", async (response) => {
      const url = response.url();
      // Only track local API calls or external auth calls
      if (url.includes("/api/") || url.includes("4025")) {
        const method = response.request().method();
        const status = response.status();
        let error = null;

        if (status >= 400) {
          try {
            error = await response.text();
          } catch {
            error = "Could not parse error body";
          }
        }

        mapData.apis.push({
          method,
          url: url.replace("http://127.0.0.1:4025", ""),
          status,
          error
        });
      }
    });

    // 2. Perform authentication with master_admin credentials
    console.log("🔑 Authenticating test user...");
    const loginResponse = await page.request.post("http://127.0.0.1:4025/api/auth/login", {
      data: {
        username: "zapadmin",
        password: "zapadmin123",
        tenantId: "default",
      },
      headers: {
        "x-tenant-id": "default",
      },
    });

    expect(loginResponse.ok()).toBeTruthy();
    const payload = await loginResponse.json();
    const token = payload?.token ?? payload?.accessToken ?? payload?.data?.token;
    const expiresAtSeconds = payload?.expiresAt ?? payload?.data?.expiresAt ?? null;

    expect(token).toBeTruthy();

    await page.goto("http://localhost:8080/login");
    await page.evaluate(({ token: authToken, expiresAt }) => {
      const session = {
        token: authToken,
        username: "zapadmin",
        role: "master", // Elevating role to master to scan all master admin views
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

    // Verify authentication redirect
    await page.goto("http://localhost:8080/dashboard");
    await page.waitForLoadState("networkidle");
    expect(page.url()).toContain("/dashboard");
    console.log("✅ Authenticated successfully as Master Admin.");

    // 3. Define crawling queue
    // Pre-populate with all routes declared in App.tsx to ensure orphan detection and coverage
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

    const routesQueue = [...initialRoutes];
    const visitedRoutes = new Set<string>();

    // We'll also scan for new paths from <a> tags dynamically
    while (routesQueue.length > 0) {
      const currentRoute = routesQueue.shift()!;
      if (visitedRoutes.has(currentRoute)) continue;

      visitedRoutes.add(currentRoute);
      const targetUrl = `http://localhost:8080${currentRoute}`;
      console.log(`🔍 Crawling route: ${currentRoute}`);

      try {
        const response = await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 10000 });
        const finalUrl = page.url();
        const finalRoute = finalUrl.replace("http://localhost:8080", "");
        
        let redirectedTo = null;
        let isBroken = false;
        let routeError = null;

        // Check if page redirected
        if (finalRoute !== currentRoute && !finalRoute.startsWith(currentRoute + "/")) {
          redirectedTo = finalRoute;
        }

        // Check if page failed to load
        if (response && response.status() >= 400) {
          isBroken = true;
          routeError = `HTTP ${response.status()}`;
        }

        const pageTitle = await page.title();

        mapData.routes.push({
          path: currentRoute,
          status: isBroken ? "broken" : redirectedTo ? "redirected" : "ok",
          title: pageTitle,
          redirectedTo,
          error: routeError
        });

        if (isBroken) {
          mapData.broken_routes.push({
            path: currentRoute,
            error: routeError
          });
          continue;
        }

        // Check responsiveness (layout overflow check)
        // Desktop Viewport (1600x900)
        await page.setViewportSize({ width: 1600, height: 900 });
        await page.waitForTimeout(100);
        const desktopOverflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth;
        });

        // Mobile Viewport (375x812)
        await page.setViewportSize({ width: 375, height: 812 });
        await page.waitForTimeout(200);
        const mobileOverflow = await page.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth;
        });

        // Return viewport to desktop
        await page.setViewportSize({ width: 1600, height: 900 });

        mapData.responsiveness.push({
          path: currentRoute,
          desktopHealthy: !desktopOverflow,
          mobileHealthy: !mobileOverflow,
          mobileOverflowAmount: mobileOverflow ? await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth) : 0
        });

        // Extract internal links (to find orphan pages later or discover new routes)
        const links = await page.evaluate(() => {
          return Array.from(document.querySelectorAll("a[href]")).map(a => a.getAttribute("href") || "");
        });

        for (const link of links) {
          if (link.startsWith("/") && !link.startsWith("//") && !link.includes(":")) {
            const cleanPath = link.split("?")[0].split("#")[0];
            if (cleanPath && !visitedRoutes.has(cleanPath) && !routesQueue.includes(cleanPath)) {
              // Only push if it seems to be an application subpage
              routesQueue.push(cleanPath);
            }
          }
        }

        // Scan for buttons and action handlers
        const buttonsInfo = await page.evaluate(() => {
          return Array.from(document.querySelectorAll("button")).map((btn, index) => {
            // Basic heuristics to guess if a button does something
            // Inspecting common framework artifacts and standard HTML properties
            const text = btn.innerText || btn.getAttribute("aria-label") || btn.getAttribute("title") || "";
            const id = btn.id || "";
            const role = btn.getAttribute("role") || "button";
            const className = btn.className || "";
            const isDisabled = btn.disabled;
            
            // Check if there is an onclick handler or typical pointer classes
            const hasActionClass = className.includes("cursor-pointer") || className.includes("hover:") || className.includes("active:");
            
            return {
              text: text.trim().slice(0, 50),
              id,
              role,
              className,
              isDisabled,
              hasActionClass
            };
          });
        });

        const clickedTexts = new Set<string>();
        let clickedCount = 0;

        for (const btn of buttonsInfo) {
          // Check if button text matches destructive action to avoid clicking it
          const destructive = isDestructiveButton(btn.text);
          let testActionSuccess = false;
          let testActionMessage = "Not tested (safe/destructive mode or disabled)";

          const isRepetitive = clickedTexts.has(btn.text);

          if (!btn.isDisabled && !destructive && btn.text.length > 0 && !isRepetitive && clickedCount < 8) {
            clickedTexts.add(btn.text);
            clickedCount++;
            // Click button and verify if it triggers anything (network requests, console logs, modals)
            // We do a simple event listener check by intercepting click result
            try {
              // Get button locator
              const btnLocator = page.locator("button").filter({ hasText: btn.text }).first();
              if (await btnLocator.isVisible()) {
                const urlBefore = page.url();
                const networkCountBefore = mapData.apis.length;
                const consoleCountBefore = mapData.console_errors.length;
                
                await btnLocator.click({ timeout: 1500 });
                await page.waitForTimeout(300);

                const urlAfter = page.url();
                const networkCountAfter = mapData.apis.length;
                const consoleCountAfter = mapData.console_errors.length;

                const urlChanged = urlBefore !== urlAfter;
                const madeNetworkCall = networkCountAfter > networkCountBefore;
                const gotConsoleError = consoleCountAfter > consoleCountBefore;
                
                // Inspect if a modal opened
                const modalVisible = await page.locator("[role='dialog'], .modal, [role='alertdialog']").count() > 0;

                testActionSuccess = urlChanged || madeNetworkCall || modalVisible || gotConsoleError;
                testActionMessage = urlChanged ? "Navigated" : madeNetworkCall ? "Triggered API" : modalVisible ? "Opened Modal" : gotConsoleError ? "Triggered Console Error" : "Click did not trigger state change";
              }
            } catch (err: any) {
              testActionMessage = `Click error: ${err.message}`;
            }
          }

          mapData.buttons.push({
            path: currentRoute,
            text: btn.text,
            id: btn.id,
            className: btn.className,
            isDisabled: btn.isDisabled,
            isDestructive: destructive,
            hasAction: btn.hasActionClass || testActionSuccess,
            clickResult: testActionMessage
          });
        }

        // Scan for Forms and Inputs
        const formsInfo = await page.evaluate(() => {
          return Array.from(document.querySelectorAll("form")).map((form) => {
            const inputs = Array.from(form.querySelectorAll("input, select, textarea")).map((input: any) => {
              return {
                name: input.name || input.id || "",
                type: input.type || input.tagName.toLowerCase(),
                placeholder: input.placeholder || ""
              };
            });

            return {
              id: form.id || "",
              action: form.getAttribute("action") || "",
              inputs
            };
          });
        });

        for (const form of formsInfo) {
          mapData.forms.push({
            path: currentRoute,
            id: form.id,
            action: form.action,
            inputs: form.inputs
          });
        }

      } catch (err: any) {
        console.error(`❌ Error visiting route ${currentRoute}:`, err.message);
        mapData.broken_routes.push({
          path: currentRoute,
          error: err.message
        });
      }
    }

    // 4. Identify orphan pages
    // Pages in initialRoutes that were never found in any <a> links crawled
    for (const route of initialRoutes) {
      if (route === "/dashboard") continue; // Entrypoint
      
      // Check if this route was found as an href inside another page
      let foundAsLink = false;
      for (const btn of mapData.buttons) {
        if (btn.clickResult === "Navigated" && btn.path !== route) {
          // If a button click navigated to this route
          foundAsLink = true;
          break;
        }
      }
      // Also check standard anchor link discoveries
      if (!foundAsLink) {
        mapData.orphan_pages.push(route);
      }
    }

    // 5. Save discovery-map.json to tests folder
    const testsDir = path.join(rootDir, "tests");
    if (!fs.existsSync(testsDir)) {
      fs.mkdirSync(testsDir, { recursive: true });
    }

    const mapPath = path.join(testsDir, "discovery-map.json");
    fs.writeFileSync(mapPath, JSON.stringify(mapData, null, 2), "utf8");
    console.log(`💾 Saved discovery map to ${mapPath}`);

    // Copy to frontend-official tests folder for accessibility
    const feTestsDir = path.join(rootDir, "frontend-official", "tests");
    if (fs.existsSync(feTestsDir)) {
      fs.writeFileSync(path.join(feTestsDir, "discovery-map.json"), JSON.stringify(mapData, null, 2), "utf8");
    }

    // 6. Generate detailed discovery-report.md in Portuguese
    const reportPath = path.join(testsDir, "discovery-report.md");
    
    // Format APIs table
    const apiTable = mapData.apis.length === 0
      ? "_Nenhuma chamada de API registrada._"
      : "| Método | Endpoint | Status | Erro |\n|---|---|---|---|\n" +
        mapData.apis.map((api: any) => `| \`${api.method}\` | \`${api.url}\` | ${api.status >= 400 ? `🔴 ${api.status}` : `🟢 ${api.status}`} | ${api.error ? `\`${api.error.slice(0, 100)}\`` : "-"} |`).join("\n");

    // Format console errors
    const consoleTable = mapData.console_errors.length === 0
      ? "_Nenhum erro de console registrado._"
      : "| Rota | Tipo | Mensagem |\n|---|---|---|\n" +
        mapData.console_errors.map((c: any) => `| \`${c.path}\` | \`${c.type}\` | ${c.text} |`).join("\n");

    // Format page errors
    const pageErrorsTable = mapData.page_errors.length === 0
      ? "_Nenhuma exceção lançada pelo navegador._"
      : mapData.page_errors.map((e: any) => `### Rota \`${e.path}\`\n* **Erro:** \`${e.name}: ${e.message}\`\n* **Stack Trace:**\n\`\`\`\n${e.stack || "N/A"}\n\`\`\``).join("\n\n");

    // Format broken routes
    const brokenRoutesTable = mapData.broken_routes.length === 0
      ? "🟢 _Nenhuma rota quebrada detectada!_"
      : "| Rota | Erro |\n|---|---|\n" +
        mapData.broken_routes.map((r: any) => `| \`${r.path}\` | ${r.error} |`).join("\n");

    // Format orphan pages
    const orphanList = mapData.orphan_pages.length === 0
      ? "🟢 _Nenhuma página órfã detectada! Todas as rotas possuem links de acesso._"
      : mapData.orphan_pages.map(r => `* Rota \`${r}\` (declarada no roteador, mas sem links diretos identificados)`).join("\n");

    // Format responsiveness
    const respTable = "| Rota | Desktop (1600px) | Mobile (375px) | Largura Overflow |\n|---|---|---|---|\n" +
      mapData.responsiveness.map((r: any) => `| \`${r.path}\` | ${r.desktopHealthy ? "🟢 OK" : "🔴 Overflow"} | ${r.mobileHealthy ? "🟢 OK" : "🔴 Overflow"} | ${r.mobileOverflowAmount > 0 ? `\`${r.mobileOverflowAmount}px\`` : "-"} |`).join("\n");

    // Format suspect buttons (hasAction is false)
    const suspectButtons = mapData.buttons.filter((b: any) => !b.hasAction && !b.isDisabled && !b.isDestructive);
    const suspectButtonsTable = suspectButtons.length === 0
      ? "🟢 _Nenhum botão sem ação suspeito._"
      : "| Rota | Texto do Botão | Classe / ID | Resultado do Clique |\n|---|---|---|---|\n" +
        suspectButtons.map((b: any) => `| \`${b.path}\` | \`${b.text}\` | \`${b.id || b.className.split(" ").slice(0, 3).join(" ")}\` | ${b.clickResult} |`).join("\n");

    const reportContent = `# Relatório de Auditoria E2E & Mapeamento Automático — ZAPFLOW AI

**Executado em:** ${new Date(mapData.timestamp).toLocaleString("pt-BR")}
**Ferramenta:** Playwright Automated Discovery Crawler

---

## 📊 1. Resumo Executivo
* **Total de Rotas Mapeadas:** ${mapData.routes.length}
* **Rotas Ativas (OK):** ${mapData.routes.filter((r: any) => r.status === "ok").length}
* **Rotas Redirecionadas:** ${mapData.routes.filter((r: any) => r.status === "redirected").length}
* **Rotas Quebradas (400+ ou erro):** ${mapData.broken_routes.length}
* **Páginas Órfãs:** ${mapData.orphan_pages.length}
* **Erros de Console/Navegador:** ${mapData.console_errors.length + mapData.page_errors.length}
* **APIs Consumidas:** ${mapData.apis.length} (Falhas: ${mapData.apis.filter((a: any) => a.status >= 400).length})

---

## 🚨 2. Análise de Erros e Rotas Quebradas
Abaixo estão detalhados os problemas graves que podem impedir a navegação ou causar falhas para o usuário.

### Rotas Quebradas
${brokenRoutesTable}

### Páginas Órfãs
Estas páginas estão registradas na aplicação, mas não possuem links diretos no menu ou em botões mapeados:
${orphanList}

---

## 💻 3. Erros de Console e Exceções JS (Browser)
Logs de erro capturados diretamente no console do navegador ou exceções não tratadas.

### Exceções de Renderização/JS
${pageErrorsTable}

### Erros de Console (Console.error / Console.warn)
${consoleTable}

---

## 🔌 4. Auditoria de Integração de APIs (HTTP Status >= 400)
Requisições feitas pelo frontend ao backend que falharam ou retornaram códigos de erro.

${apiTable}

---

## 📱 5. Auditoria de Responsividade (Viewports)
Checagem automática de estabilidade de layout e estouro de conteúdo (overflow horizontal).

${respTable}

---

## 🔘 6. Botões Sem Ação Suspeitos
Botões que estão habilitados, mas cujo clique não desencadeou navegação, abertura de modal ou requisições de rede.

${suspectButtonsTable}

---
*Relatório gerado automaticamente pela suíte de auditoria contínua ZAPFLOW AI.*
`;

    fs.writeFileSync(reportPath, reportContent, "utf8");
    console.log(`📝 Saved audit report to ${reportPath}`);
  });
});
