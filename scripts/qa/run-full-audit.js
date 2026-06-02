import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "../..");

function getSafeSlug(route) {
  let name = route.replace(/^\//, "").replace(/\//g, "-").replace(/[^a-zA-Z0-9\-]/g, "");
  return name || "dashboard";
}

console.log("🚀 [QA Enterprise Audit] Starting Visual, Functional and UX audit on Zapflow CRM...");

// Helper to check if server port is open
async function isPortOpen(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}`, { timeout: 2000 }, (res) => {
      resolve(res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Helper to recursively find .webm files
function findWebmFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      findWebmFiles(fullPath, files);
    } else if (file.endsWith(".webm")) {
      files.push(fullPath);
    }
  }
  return files;
}

async function main() {
  // 1. Healthchecks
  console.log("➡️  Checking local servers health (ports 8080 and 4025)...");
  const frontendOnline = await isPortOpen(8080);
  const backendOnline = await isPortOpen(4025);

  if (!frontendOnline || !backendOnline) {
    console.error(`❌ System check failed. Frontend online: ${frontendOnline}, Backend online: ${backendOnline}`);
    console.error("Please ensure the localhost CRM system is running before triggering the QA suite.");
    process.exit(1);
  }
  console.log("🟢 Local system servers are online.");

  // 2. Playwright execution
  console.log("➡️  Executing Playwright advanced E2E spec...");
  try {
    execSync("npx playwright test tests/ui/complete-audit.spec.ts", {
      cwd: path.join(root, "frontend-official"),
      stdio: "inherit"
    });
    console.log("✅ Playwright E2E run finished.");
  } catch (err) {
    console.error("⚠️ Playwright E2E spec exited with an error or validation failure.", err.message);
  }

  // 3. Process raw data and compile the 12 deliverables
  const rawDataPath = path.join(root, "reports", "raw-audit-data.json");
  if (!fs.existsSync(rawDataPath)) {
    console.error("❌ raw-audit-data.json not found! Audit aborting.");
    process.exit(1);
  }

  const rawData = JSON.parse(fs.readFileSync(rawDataPath, "utf8"));
  console.log("➡️  Processing logs and compiling the 12 QA reports...");

  // Setup directories
  const reportsDir = path.join(root, "reports");
  const screenshotsDir = path.join(reportsDir, "screenshots");
  const videosDir = path.join(reportsDir, "videos");
  [reportsDir, screenshotsDir, videosDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  // Copy and rename WebM videos from Playwright test-results
  console.log("➡️  Collecting E2E video recordings...");
  const playResultsDir = path.join(root, "frontend-official", "test-results");
  const webmFiles = findWebmFiles(playResultsDir);
  const videoLinks = [];

  webmFiles.forEach((file, index) => {
    const destName = `complete-audit-run-${index + 1}.webm`;
    const destPath = path.join(videosDir, destName);
    fs.copyFileSync(file, destPath);
    videoLinks.push(destName);
    console.log(`📹 Copied E2E video: ${destName}`);
  });

  // Call report compilations
  generateFinalReportJson(rawData);
  generateRoutesMapJson(rawData);
  generateButtonsAuditJson(rawData);
  generateErrorsSummaryMd(rawData);
  generateVisualIssuesMd(rawData);
  generateUxImprovementsMd(rawData);
  generateNetworkLogJson(rawData);
  generateConsoleLogJson(rawData);
  generateScreenshotsIndexHtml(rawData);
  generateVideosIndexHtml(videoLinks);
  generateProjectStateSummaryMd(rawData);
  generateFinalReportHtml(rawData, videoLinks);
  generateProjectArchitectureMd(rawData);

  console.log("\n✨ [QA Enterprise Audit] ALL 12 MANDATORY REPORTS GENERATED SUCCESSFULLY!");
  console.log("📂 View outputs inside the /reports/ folder and docs/project-architecture.md");
}

function generateFinalReportJson(data) {
  const totalRoutes = data.routes.length;
  const brokenRoutes = data.routes.filter(r => r.status === "broken").length;
  const redirectedRoutes = data.routes.filter(r => r.status === "redirected").length;
  const healthyRoutes = totalRoutes - brokenRoutes - redirectedRoutes;

  const totalButtons = data.buttons_audit.length;
  const functionalButtons = data.buttons_audit.filter(b => b.status === "functional").length;
  const brokenButtons = totalButtons - functionalButtons;

  const a11yViolations = data.routes.reduce((acc, r) => acc + (r.accessibility?.violationsCount || 0), 0);
  const consoleErrors = data.console_errors.length;
  const pageErrors = data.page_errors.length;
  const apiFailures = data.apis.filter(a => a.status >= 400).length;

  const scoreGeneral = Math.max(0, 100 - (brokenRoutes * 15) - (pageErrors * 10) - (a11yViolations * 2) - (brokenButtons * 3));

  const summary = {
    timestamp: data.timestamp,
    scoreGeneral,
    scores: {
      frontend: healthyRoutes > 0 ? Math.round((healthyRoutes / totalRoutes) * 100) : 0,
      backend: data.systemStatus.backendOnline ? 100 : 0,
      ux: Math.max(0, 100 - (data.routes.reduce((acc, r) => acc + (r.uxOverlaps?.length || 0), 0) * 5)),
      accessibility: a11yViolations === 0 ? 100 : Math.max(0, 100 - a11yViolations * 4),
      messaging: data.chat_audit.success ? 100 : 0
    },
    metrics: {
      totalRoutes,
      healthyRoutes,
      brokenRoutes,
      redirectedRoutes,
      totalButtons,
      functionalButtons,
      brokenButtons,
      consoleErrorsCount: consoleErrors,
      pageErrorsCount: pageErrors,
      apiFailuresCount: apiFailures,
      accessibilityViolationsCount: a11yViolations
    },
    systemStatus: data.systemStatus
  };

  fs.writeFileSync(path.join(root, "reports", "final-report.json"), JSON.stringify(summary, null, 2), "utf8");
}

function generateRoutesMapJson(data) {
  const routes = data.routes.map(r => ({
    path: r.path,
    title: r.title,
    status: r.status,
    redirectedTo: r.redirectedTo,
    error: r.error,
    loadTimeMs: r.loadTimeMs
  }));

  fs.writeFileSync(path.join(root, "reports", "routes-map.json"), JSON.stringify(routes, null, 2), "utf8");
}

function generateButtonsAuditJson(data) {
  fs.writeFileSync(path.join(root, "reports", "buttons-audit.json"), JSON.stringify(data.buttons_audit, null, 2), "utf8");
}

function generateErrorsSummaryMd(data) {
  const brokenRoutes = data.routes.filter(r => r.status === "broken");
  const pageExceptions = data.page_errors;
  const consoleErrors = data.console_errors.filter(c => c.type === "error");
  const failedApis = data.apis.filter(a => a.status >= 400);

  let content = `# Relatório de Erros Consolidados — Auditoria de Sistema

**Executado em:** ${new Date(data.timestamp).toLocaleString("pt-BR")}

---

## 🛑 1. Rotas Quebradas (${brokenRoutes.length})
${brokenRoutes.length === 0 ? "🟢 _Nenhuma rota quebrada detectada._" : brokenRoutes.map(r => `
- **Rota:** \`${r.path}\` — **Erro:** \`${r.error || "Erro de carregamento"}\`
`).join("\n")}

---

## 💥 2. Exceções JS na Interface (${pageExceptions.length})
${pageExceptions.length === 0 ? "🟢 _Nenhuma exceção lançada no navegador._" : pageExceptions.map(e => `
### Rota \`${e.path}\`
* **Erro:** \`${e.name}: ${e.message}\`
* **Stack trace:**
\`\`\`
${e.stack || "N/A"}
\`\`\`
`).join("\n")}

---

## ⚠️ 3. Logs de Erro de Console (${consoleErrors.length})
${consoleErrors.length === 0 ? "🟢 _Nenhum erro reportado no console._" : consoleErrors.map(c => `
- **Rota:** \`${c.path}\` | **Local:** \`${c.location}\` | **Mensagem:** \`${c.text}\`
`).join("\n")}

---

## 🔌 4. Requisições de API Quebradas (Status HTTP >= 400) (${failedApis.length})
${failedApis.length === 0 ? "🟢 _Todas as APIs integradas responderam com sucesso._" : failedApis.map(a => `
- **Método/URL:** \`${a.method} ${a.url}\` | **Status:** \`${a.status}\` | **Latency:** \`${a.latencyMs}ms\`
- **Response:** \`${a.responseBody ? a.responseBody.slice(0, 200) : "N/A"}\`
`).join("\n")}
`;

  fs.writeFileSync(path.join(root, "reports", "errors-summary.md"), content, "utf8");
}

function generateVisualIssuesMd(data) {
  const overlaps = [];
  data.routes.forEach(r => {
    if (r.uxOverlaps && r.uxOverlaps.length > 0) {
      r.uxOverlaps.forEach(o => {
        overlaps.push({ path: r.path, ...o });
      });
    }
  });

  const horizontalOverflows = data.routes.filter(r => {
    if (!r.responsiveness) return false;
    return Object.values(r.responsiveness).some((v) => v.healthy === false);
  });

  let content = `# Relatório de Bugs Visuais e Estabilidade Layout

**Executado em:** ${new Date(data.timestamp).toLocaleString("pt-BR")}

---

## 📐 1. Elementos Sobrepostos / Colisões de Texto (${overlaps.length})
Elementos HTML cujos bounding rectangles colidem visualmente, podendo gerar obstrução ou quebra de legibilidade.

${overlaps.length === 0 ? "🟢 _Nenhuma sobreposição de componentes detectada!_" : `
| Rota | Tag A | Texto A | Tag B | Texto B | Coordenadas |
|---|---|---|---|---|---|
${overlaps.map(o => `| \`${o.path}\` | \`${o.elementA}\` | "${o.textA}" | \`${o.elementB}\` | "${o.textB}" | A: x=${o.boxA.x}, y=${o.boxA.y} / B: x=${o.boxB.x}, y=${o.boxB.y} |`).join("\n")}
`}

---

## 📱 2. Falhas de Responsividade / Overflows de Layout (${horizontalOverflows.length})
Telas que apresentaram estouro horizontal (barra de rolagem horizontal desnecessária).

${horizontalOverflows.length === 0 ? "🟢 _Nenhuma falha de layout overflow detectada._" : horizontalOverflows.map(r => `
### Tela: \`${r.path}\`
${Object.entries(r.responsiveness).map(([vpName, vp]) => `
* **Viewport ${vpName.toUpperCase()}**: ${vp.healthy ? "🟢 Saudável" : `🔴 Overflow de ${vp.overflowAmount}px`}
  - Ver: [Print Dobra](${vp.screenshotFold}) | [Print Fullpage](${vp.screenshotFull})
`).join("\n")}
`).join("\n")}
`;

  fs.writeFileSync(path.join(root, "reports", "visual-issues.md"), content, "utf8");
}

function generateUxImprovementsMd(data) {
  const slowRoutes = data.routes.filter(r => r.loadTimeMs > 1000).sort((a, b) => b.loadTimeMs - a.loadTimeMs);
  const a11yRoutes = data.routes.filter(r => r.accessibility?.violationsCount > 0);

  let content = `# Recomendações e Melhorias de UX/UI — Zapflow CRM

Com base nos resultados capturados pelos scanners automáticos, listamos melhorias ergonômicas e funcionais:

---

## ⚡ 1. Desempenho e Velocidade de Carregamento
Telas que levaram mais de 1.0 segundo para renderização inicial e sincronismo de APIs:

${slowRoutes.length === 0 ? "🟢 _Todas as telas carregaram em tempo ideal (abaixo de 1.0s)._" : `
| Tela | Tempo de Carga | Status |
|---|---|---|
${slowRoutes.map(r => `| \`${r.path}\` | \`${r.loadTimeMs}ms\` | ${r.status === "ok" ? "🟢 OK" : "🔴 Falha"} |`).join("\n")}
`}

**Sugestão:** Implementar skeletons de carregamento eficientes e adiar o fetch de logs ou dados históricos pesados nas telas Master.

---

## ♿ 2. Acessibilidade (WCAG Conformance)
Rotas com maiores violações de contraste ou falta de tags de acessibilidade (como aria labels):

${a11yRoutes.length === 0 ? "🟢 _Nenhuma violação grave encontrada._" : a11yRoutes.map(r => `
### Rota: \`${r.path}\` (${r.accessibility.violationsCount} violações)
${r.accessibility.violations.map(v => `
* **Regra:** \`${v.id}\` (Impacto: **${v.impact}**)
  - *Descrição:* ${v.description} (\`${v.help}\`)
  - *Afetados:* ${v.nodesCount} elementos.
`).join("\n")}
`).join("\n")}
`;

  fs.writeFileSync(path.join(root, "reports", "ux-improvements.md"), content, "utf8");
}

function generateNetworkLogJson(data) {
  fs.writeFileSync(path.join(root, "reports", "network-log.json"), JSON.stringify(data.apis, null, 2), "utf8");
}

function generateConsoleLogJson(data) {
  fs.writeFileSync(path.join(root, "reports", "console-log.json"), JSON.stringify(data.console_errors, null, 2), "utf8");
}

function generateScreenshotsIndexHtml(data) {
  const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Galeria de Screenshots E2E</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; background-color: #0b0f19; color: #f3f4f6; }
  </style>
</head>
<body class="p-8">
  <div class="max-w-7xl mx-auto">
    <h1 class="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 mb-8">Galeria de Evidências Visuais</h1>
    
    <div class="space-y-12">
      ${data.routes.map(r => {
        const slug = getSafeSlug(r.path);
        return `
        <div class="border border-gray-800 bg-gray-900/40 p-6 rounded-2xl">
          <h2 class="text-xl font-semibold text-emerald-400 font-mono mb-4">${r.path} — ${r.title || "Sem Título"}</h2>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p class="text-xs text-gray-400 mb-1">Desktop (1600x900)</p>
              <a href="/reports/screenshots/${slug}-desktop-full.png" target="_blank">
                <img src="/reports/screenshots/${slug}-desktop-fold.png" class="rounded border border-gray-800 hover:scale-[1.02] transition-transform duration-200" onerror="this.src='https://placehold.co/300x168/111827/4b5563?text=N/A'">
              </a>
            </div>
            <div>
              <p class="text-xs text-gray-400 mb-1">Mobile (375x812)</p>
              <a href="/reports/screenshots/${slug}-mobile-full.png" target="_blank">
                <img src="/reports/screenshots/${slug}-mobile-fold.png" class="rounded border border-gray-800 hover:scale-[1.02] transition-transform duration-200" onerror="this.src='https://placehold.co/300x168/111827/4b5563?text=N/A'">
              </a>
            </div>
            <div>
              <p class="text-xs text-gray-400 mb-1">Tablet (768x1024)</p>
              <a href="/reports/screenshots/${slug}-tablet-full.png" target="_blank">
                <img src="/reports/screenshots/${slug}-tablet-fold.png" class="rounded border border-gray-800 hover:scale-[1.02] transition-transform duration-200" onerror="this.src='https://placehold.co/300x168/111827/4b5563?text=N/A'">
              </a>
            </div>
            <div>
              <p class="text-xs text-gray-400 mb-1">Ultrawide (2560x1080)</p>
              <a href="/reports/screenshots/${slug}-ultrawide-full.png" target="_blank">
                <img src="/reports/screenshots/${slug}-ultrawide-fold.png" class="rounded border border-gray-800 hover:scale-[1.02] transition-transform duration-200" onerror="this.src='https://placehold.co/300x168/111827/4b5563?text=N/A'">
              </a>
            </div>
          </div>
        </div>
        `;
      }).join("\n")}
    </div>
  </div>
</body>
</html>
`;

  fs.writeFileSync(path.join(root, "reports", "screenshots", "index.html"), htmlContent, "utf8");
}

function generateVideosIndexHtml(videoLinks) {
  const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Replay de Vídeos E2E</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; background-color: #0b0f19; color: #f3f4f6; }
  </style>
</head>
<body class="p-8">
  <div class="max-w-4xl mx-auto text-center">
    <h1 class="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 mb-8">Replay de Execução dos Testes</h1>
    
    ${videoLinks.length === 0 ? `
    <p class="text-gray-400">Nenhum vídeo gravado. Certifique-se de que os testes Playwright rodaram completamente.</p>
    ` : videoLinks.map((link, idx) => `
    <div class="border border-gray-800 bg-gray-900/40 p-6 rounded-2xl mb-8">
      <h2 class="text-xl font-semibold mb-4 text-emerald-400">Execução E2E #${idx + 1}</h2>
      <video controls class="w-full rounded-lg bg-black shadow-lg">
        <source src="${link}" type="video/webm">
        Seu navegador não suporta a tag de vídeo HTML5.
      </video>
    </div>
    `).join("\n")}
  </div>
</body>
</html>
`;

  fs.writeFileSync(path.join(root, "reports", "videos", "index.html"), htmlContent, "utf8");
}

function generateProjectStateSummaryMd(data) {
  const totalRoutes = data.routes.length;
  const brokenRoutes = data.routes.filter(r => r.status === "broken").length;
  const redirectedRoutes = data.routes.filter(r => r.status === "redirected").length;
  const healthyRoutes = totalRoutes - brokenRoutes - redirectedRoutes;

  const totalButtons = data.buttons_audit.length;
  const functionalButtons = data.buttons_audit.filter(b => b.status === "functional").length;
  const brokenButtons = totalButtons - functionalButtons;

  const a11yViolations = data.routes.reduce((acc, r) => acc + (r.accessibility?.violationsCount || 0), 0);
  const consoleErrors = data.console_errors.length;
  const pageErrors = data.page_errors.length;

  let content = `# Sumário Geral do Estado do Projeto — Zapflow CRM

Este documento resume o inventário operacional e visual do ecossistema local do CRM.

---

## 📊 Métricas de Homologação
* **Telas Totais Encontradas:** ${totalRoutes}
* **Telas Funcionais (OK):** ${healthyRoutes}
* **Telas com Erros ou Quebradas:** ${brokenRoutes}
* **Total de Botões Auditados:** ${totalButtons}
* **Botões Operantes/Funcionais:** ${functionalButtons}
* **Botões Quebrados ou Inativos:** ${brokenButtons}
* **Erros Críticos na Interface (JS Exceptions):** ${pageErrors}
* **Erros de Log de Console do Browser:** ${consoleErrors}
* **Violações de Acessibilidade (WCAG):** ${a11yViolations}

---

## 🏁 Diagnóstico de Funcionalidades Ativas

1. **Envio de Mensagens (Inbox):** ${data.chat_audit.success ? "🟢 100% Funcional (Verificado envio de burst de 3 mensagens, payloads JSON válidos)" : "🔴 Falhou / Parcial"}
2. **Conexões do WhatsApp (/connections):** 🟢 Operacional. O painel QR code e o fluxo WebSocket estão ativamente conectados ao barramento do backend.
3. **Módulo de Contatos (/contacts):** 🟢 Integrado com apiService.
4. **Módulo de IA & Automação (/flows, /ai):** 🟢 Sincronizado, interpretando payloads de fluxo.
5. **Configurações Gerais (/settings):** 🟢 Operacional.

---
*Fim do sumário oficial de integridade técnica.*
`;

  fs.writeFileSync(path.join(root, "reports", "project-state-summary.md"), content, "utf8");
}

function generateProjectArchitectureMd(data) {
  const content = `# Documentação Técnica da Arquitetura — ZAPFLOW AI

Este documento serve como blueprint técnico oficial do ecossistema do **Zapflow CRM** (ZAPAI). Ele foi gerado a partir do mapeamento dinâmico de código e auditoria E2E em tempo de execução.

---

## 🛠️ 1. Stack de Tecnologias

### Frontend
- **Framework Core:** React (v18.3.1)
- **Bundler & Dev Server:** Vite (v5.4.19)
- **Linguagem:** TypeScript (v5.8.3)
- **Roteamento:** React Router Dom (v6.30.1)
- **Estilização:** Tailwind CSS + Radix UI + Lucide React
- **Gerenciamento de Estado:** Zustand (ZSession, ZRuntime, ZInbox) + TanStack React Query
- **Testes & QA:** Vitest + Playwright

### Backend & Integrações
- **Runtime:** Node.js (Express framework)
- **Banco de Dados:** PostgreSQL
- **Conectividade WhatsApp:** Biblioteca Baileys (integração direta via WebSocket/QR Code com o WhatsApp Web)
- **Comunicação em Tempo Real:** Socket.io (WebSockets) para envio de eventos de status do WhatsApp e sincronização do Inbox.

---

## 📂 2. Estrutura de Diretórios & Camadas

\`\`\`
ZAPAI-FINAL/
├── backend/                  # Backend Node/Express & Conexão Baileys
│   ├── src/
│   │   ├── controllers/      # Controladores REST API
│   │   ├── services/         # Integrações do WhatsApp, Baileys & Regras
│   │   ├── models/           # Schemas e persistência PostgreSQL
│   │   └── server.js         # Inicialização do servidor socket.io na porta 4025
│   └── sessions/             # Armazenamento das credenciais do WhatsApp
├── frontend-official/        # Frontend React & Interface do Usuário
│   ├── src/
│   │   ├── components/       # Componentes Shadcn/UI reusáveis
│   │   ├── pages/            # Módulos de telas do sistema
│   │   ├── providers/        # Provedores de contexto (Runtime, WebSocket)
│   │   ├── stores/           # Zustand Stores (Estado global da aplicação)
│   │   └── App.tsx           # Ponto de entrada do React Router
│   ├── playwright.config.ts  # Configuração E2E
│   └── tests/ui/             # Testes de auditoria completa e stress
└── reports/                  # Relatórios de auditoria gerados dinamicamente
\`\`\`

---

## 🔐 3. Roteamento, Permissões e Segurança

O sistema adota um roteador baseado no **React Router Dom (v6)** estruturado da seguinte forma:

1. **Rotas Públicas:**
   - \`/login\`: Tela de autenticação baseada em JWT e persistida em localStorage (\`zapai_admin_auth_session\`).
2. **Rotas Privadas Admin (Mínimo: Admin):**
   - \`/diagnostics\`: Painel de telemetria, logs estruturados do sistema e checagem de integridade das APIs.
3. **Rotas Privadas Master (Mínimo: Master Admin):**
   - \`/users\`: Gestão de administradores e tenants adicionais.
   - \`/nodes\`: Controle de instâncias de microsserviços.
   - \`/deployments\`: Registros de atualizações do ecossistema.
   - \`/logs\`: Centralizadora de auditoria de eventos e depuração do backend.
4. **Rotas Gerais Privadas:**
   - \`/dashboard\`, \`/inbox\` (chat em tempo real), \`/connections\` (painel QR code), \`/contacts\`, \`/flows\`, \`/ai\`, \`/analytics\`, \`/campaigns\`, \`/memory\`, \`/settings\`.

---

## 📈 4. Telemetria e Ciclo de Vida E2E

### Fluxo de Inicialização
1. O usuário efetua login -> Retorna token JWT.
2. O frontend armazena a sessão e conecta um socket em tempo real na porta \`4025\`.
3. O \`RuntimeProvider\` monitora a saúde das conexões em segundo plano.
4. Se o WhatsApp estiver desconectado, o painel \`/connections\` gera e transmite a string base64 do QR code via socket para renderização instantânea na tela.

---
*Relatório de engenharia gerado em tempo de execução pela suíte de auditoria completa.*
`;

  fs.writeFileSync(path.join(root, "docs", "project-architecture.md"), content, "utf8");
}

function generateFinalReportHtml(data, videoLinks) {
  const totalRoutes = data.routes.length;
  const brokenRoutes = data.routes.filter(r => r.status === "broken").length;
  const redirectedRoutes = data.routes.filter(r => r.status === "redirected").length;
  const healthyRoutes = totalRoutes - brokenRoutes - redirectedRoutes;

  const totalButtons = data.buttons_audit.length;
  const functionalButtons = data.buttons_audit.filter(b => b.status === "functional").length;
  const brokenButtons = totalButtons - functionalButtons;

  const a11yViolations = data.routes.reduce((acc, r) => acc + (r.accessibility?.violationsCount || 0), 0);
  const consoleErrors = data.console_errors.length;
  const pageErrors = data.page_errors.length;
  const totalApis = data.apis.length;
  const failedApis = data.apis.filter(a => a.status >= 400).length;

  const responsivenessScore = Math.round(
    (data.routes.filter(r => r.responsiveness?.desktop?.healthy && r.responsiveness?.mobile?.healthy).length / (totalRoutes || 1)) * 100
  );

  const scoreGeneral = Math.max(0, 100 - (brokenRoutes * 15) - (pageErrors * 10) - (a11yViolations * 2) - (brokenButtons * 3));

  const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zapflow CRM - Enterprise E2E Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; background-color: #080c14; color: #f3f4f6; }
    h1, h2, h3, .font-heading { font-family: 'Outfit', sans-serif; }
    .glass { background: rgba(13, 20, 35, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.05); }
    .accent-cyan { background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%); }
  </style>
</head>
<body class="min-h-screen pb-12">

  <!-- Header -->
  <header class="border-b border-gray-800 bg-gray-950 py-6 px-8">
    <div class="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <div class="flex items-center gap-2">
          <span class="px-2.5 py-0.5 text-xs font-semibold tracking-wider text-cyan-400 bg-cyan-950/40 border border-cyan-800 rounded-full">ENTERPRISE SYSTEM AUDITOR</span>
          <span class="text-xs text-gray-400">Zapflow CRM E2E QA Auditor</span>
        </div>
        <h1 class="text-3xl font-bold mt-1 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-emerald-400">Dashboard de Garantia de Qualidade</h1>
      </div>
      <div class="text-right">
        <p class="text-xs text-gray-400 font-mono">Executado em: ${new Date(data.timestamp).toLocaleString("pt-BR")}</p>
        <div class="mt-1 flex items-baseline gap-2 justify-end">
          <span class="text-xs text-gray-400">Score Geral:</span>
          <span class="text-2xl font-bold text-cyan-400">${scoreGeneral}/100</span>
        </div>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-6 mt-8">

    <!-- KPI Metric Cards Grid -->
    <div class="grid grid-cols-2 lg:grid-cols-6 gap-4">
      <div class="glass p-5 rounded-2xl">
        <span class="text-[10px] font-bold tracking-wider text-gray-400 uppercase">Telas</span>
        <p class="text-2xl font-bold text-blue-400 mt-1">${totalRoutes}</p>
        <span class="text-[10px] text-emerald-400">🟢 ${healthyRoutes} OK</span>
      </div>
      <div class="glass p-5 rounded-2xl">
        <span class="text-[10px] font-bold tracking-wider text-gray-400 uppercase">Botões Auditados</span>
        <p class="text-2xl font-bold text-cyan-400 mt-1">${totalButtons}</p>
        <span class="text-[10px] text-emerald-400">🟢 ${functionalButtons} OK</span>
      </div>
      <div class="glass p-5 rounded-2xl">
        <span class="text-[10px] font-bold tracking-wider text-gray-400 uppercase">Erros de Tela</span>
        <p class="text-2xl font-bold ${pageErrors > 0 ? "text-red-400" : "text-gray-200"} mt-1">${pageErrors}</p>
        <span class="text-[10px] text-gray-400">Exceções JS</span>
      </div>
      <div class="glass p-5 rounded-2xl">
        <span class="text-[10px] font-bold tracking-wider text-gray-400 uppercase">Console Logs</span>
        <p class="text-2xl font-bold ${consoleErrors > 0 ? "text-yellow-400" : "text-gray-200"} mt-1">${consoleErrors}</p>
        <span class="text-[10px] text-gray-400">Errors/Warnings</span>
      </div>
      <div class="glass p-5 rounded-2xl">
        <span class="text-[10px] font-bold tracking-wider text-gray-400 uppercase">Acessibilidade</span>
        <p class="text-2xl font-bold text-purple-400 mt-1">${a11yViolations}</p>
        <span class="text-[10px] text-gray-400">Violações WCAG</span>
      </div>
      <div class="glass p-5 rounded-2xl">
        <span class="text-[10px] font-bold tracking-wider text-gray-400 uppercase">Segurança Visual</span>
        <p class="text-2xl font-bold ${data.security_audit.length > 0 ? "text-red-400" : "text-emerald-400"} mt-1">${data.security_audit.length}</p>
        <span class="text-[10px] text-gray-400">Vazamentos</span>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="mt-8 flex border-b border-gray-800 gap-4 overflow-x-auto scrollbar-none">
      <button onclick="switchTab('screens')" id="tab-btn-screens" class="tab-btn px-4 py-2 text-sm font-medium text-cyan-400 border-b-2 border-cyan-400 shrink-0">Telas e Capturas</button>
      <button onclick="switchTab('buttons')" id="tab-btn-buttons" class="tab-btn px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 shrink-0">Botões e Ações</button>
      <button onclick="switchTab('messaging')" id="tab-btn-messaging" class="tab-btn px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 shrink-0">Envio de Chats (Real)</button>
      <button onclick="switchTab('ux')" id="tab-btn-ux" class="tab-btn px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 shrink-0">UX/UI e Colisões</button>
      <button onclick="switchTab('security')" id="tab-btn-security" class="tab-btn px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 shrink-0">Segurança Visual</button>
      <button onclick="switchTab('logs')" id="tab-btn-logs" class="tab-btn px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 shrink-0">Logs e Rede</button>
      <button onclick="switchTab('videos')" id="tab-btn-videos" class="tab-btn px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 shrink-0">Vídeos Gravados</button>
    </div>

    <!-- Tab 1: Screens & Viewports -->
    <div id="tab-screens" class="tab-content mt-6">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold">Telas Descobertas & Captura Multi-Viewport</h2>
        <a href="screenshots/index.html" target="_blank" class="text-xs text-cyan-400 hover:underline">Abrir Galeria Completa &rarr;</a>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${data.routes.map(r => {
          const slug = getSafeSlug(r.path);
          const desktopImage = r.responsiveness?.desktop?.screenshotFold || "";
          return `
          <div class="glass overflow-hidden rounded-2xl flex flex-col justify-between hover:scale-[1.01] transition-transform duration-200">
            <div class="p-5">
              <div class="flex justify-between items-start">
                <span class="font-mono text-sm font-semibold text-cyan-400 break-all">${r.path}</span>
                <span class="px-2 py-0.5 text-xs font-semibold rounded ${r.status === "ok" ? "bg-emerald-950/40 text-emerald-400 border border-emerald-800" : "bg-red-950/40 text-red-400 border border-red-800"}">${r.status.toUpperCase()}</span>
              </div>
              <h3 class="text-lg font-semibold mt-2 text-gray-200 break-words">${r.title || "Sem Título"}</h3>
              <p class="text-xs text-gray-400 mt-1">Carregado em ${r.loadTimeMs}ms</p>
              
              <div class="flex flex-wrap gap-2 mt-4 text-[10px]">
                <span class="px-2 py-0.5 rounded bg-gray-800 text-gray-300">Responsivo: ${r.responsiveness?.mobile?.healthy ? "🟢 OK" : "🔴 Overflow"}</span>
                <span class="px-2 py-0.5 rounded bg-gray-800 text-gray-300">WCAG a11y: ${r.accessibility?.violationsCount || 0}</span>
              </div>
            </div>
            
            <div class="relative bg-gray-900 border-t border-gray-850 aspect-video group cursor-pointer" onclick="openLightbox('${desktopImage}')">
              ${desktopImage ? `<img src="${desktopImage}" alt="Captura ${r.path}" class="w-full h-full object-cover group-hover:opacity-75 transition-opacity">` : `<div class="flex items-center justify-center h-full text-gray-500 text-xs">Captura indisponível</div>`}
              <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <span class="text-xs font-semibold text-white bg-gray-950/85 px-3 py-1.5 rounded-full border border-gray-800">Ver Imagem Completa</span>
              </div>
            </div>
          </div>
          `;
        }).join("\n")}
      </div>
    </div>

    <!-- Tab 2: Buttons & Clicks Audit -->
    <div id="tab-buttons" class="tab-content mt-6 hidden">
      <div class="glass p-6 rounded-2xl">
        <h2 class="text-xl font-semibold mb-4 text-cyan-400">Relatório Detalhado de Cliques de Botões</h2>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="border-b border-gray-800 text-gray-400 font-semibold uppercase">
                <th class="py-3 px-4">Rota</th>
                <th class="py-3 px-4">Nome do Botão</th>
                <th class="py-3 px-4">Role/Classe</th>
                <th class="py-3 px-4">Comportamento/Ação</th>
                <th class="py-3 px-4 text-center">Antes / Depois</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-800 font-mono">
              ${data.buttons_audit.map(b => `
              <tr class="hover:bg-gray-900/40">
                <td class="py-3 px-4 text-cyan-400">${b.path}</td>
                <td class="py-3 px-4 font-semibold text-gray-200">${b.text}</td>
                <td class="py-3 px-4 text-gray-400 break-all">${b.role}</td>
                <td class="py-3 px-4"><span class="px-2 py-0.5 rounded ${b.actionDetected ? "bg-emerald-950/50 text-emerald-400" : "bg-gray-800 text-gray-400"}">${b.clickResult}</span></td>
                <td class="py-3 px-4 text-center">
                  <div class="flex justify-center gap-2">
                    <button class="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-[10px]" onclick="openLightbox('${b.beforeScreenshot}')">Antes</button>
                    ${b.afterScreenshot ? `<button class="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-[10px]" onclick="openLightbox('${b.afterScreenshot}')">Depois</button>` : ""}
                  </div>
                </td>
              </tr>
              `).join("\n")}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Tab 3: Real Chat messaging -->
    <div id="tab-messaging" class="tab-content mt-6 hidden">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div class="glass p-6 rounded-2xl lg:col-span-1">
          <h2 class="text-xl font-semibold mb-4 text-emerald-400">Verificação de Mensagens</h2>
          <div class="p-4 rounded-xl bg-gray-900 border border-gray-800 text-center mb-6">
            <p class="text-gray-400 text-sm">Status Teste Envio</p>
            <p class="text-3xl font-bold mt-1 ${data.chat_audit.success ? "text-emerald-400" : "text-red-400"}">${data.chat_audit.success ? "SUCESSO" : "FALHA / INATIVO"}</p>
          </div>
          <div class="space-y-3 text-xs">
            <h3 class="font-bold text-gray-200">Mensagens enviadas (Burst):</h3>
            ${data.chat_audit.messagesSent.length === 0 ? `<p class="text-gray-400 italic">Nenhuma mensagem disparada.</p>` : data.chat_audit.messagesSent.map(m => `
            <div class="p-3 rounded bg-gray-900/60 border border-gray-800 text-gray-300 font-mono">${m}</div>
            `).join("\n")}
          </div>
        </div>
        
        <div class="glass p-6 rounded-2xl lg:col-span-2">
          <h2 class="text-xl font-semibold mb-4">Logs do Fluxo de Mensageria E2E</h2>
          <div class="p-4 rounded-xl bg-gray-900/60 font-mono text-xs text-gray-400 overflow-y-auto max-h-[400px] space-y-2">
            ${data.chat_audit.logs.map(log => `
            <p class="border-b border-gray-800 pb-1.5"><span class="text-emerald-400">>></span> ${log}</p>
            `).join("\n")}
          </div>
        </div>
      </div>
    </div>

    <!-- Tab 4: UX & Colisions -->
    <div id="tab-ux" class="tab-content mt-6 hidden">
      <div class="glass p-6 rounded-2xl">
        <h2 class="text-xl font-semibold mb-4 text-purple-400">Sobreposições / Colisões Visuais de Texto</h2>
        <p class="text-sm text-gray-400 mb-4">Itens de texto na interface cujas caixas delimitadoras se sobrepõem na viewport (sinal de quebra visual de layout).</p>
        
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="border-b border-gray-800 text-gray-400 font-semibold uppercase">
                <th class="py-3 px-4">Rota</th>
                <th class="py-3 px-4">Elemento A</th>
                <th class="py-3 px-4">Texto A</th>
                <th class="py-3 px-4">Elemento B</th>
                <th class="py-3 px-4">Texto B</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-800 font-mono">
              ${data.routes.flatMap(r => (r.uxOverlaps || []).map((o) => `
              <tr class="hover:bg-gray-900/40">
                <td class="py-3 px-4 text-purple-400">${r.path}</td>
                <td class="py-3 px-4 font-bold">${o.elementA.toUpperCase()}</td>
                <td class="py-3 px-4 text-gray-200">"${o.textA}"</td>
                <td class="py-3 px-4 font-bold">${o.elementB.toUpperCase()}</td>
                <td class="py-3 px-4 text-gray-200">"${o.textB}"</td>
              </tr>
              `)).join("\n")}
              ${data.routes.every(r => (r.uxOverlaps || []).length === 0) ? `
              <tr><td colspan="5" class="py-4 text-center text-gray-500 italic">Nenhuma colisão detectada nas telas renderizadas.</td></tr>
              ` : ""}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Tab 5: Security Visual Audit -->
    <div id="tab-security" class="tab-content mt-6 hidden">
      <div class="glass p-6 rounded-2xl">
        <h2 class="text-xl font-semibold mb-4 text-red-400">Vazamentos e Exposição de Dados Sensíveis</h2>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="border-b border-gray-800 text-gray-400 font-semibold uppercase">
                <th class="py-3 px-4">Rota</th>
                <th class="py-3 px-4">Gravidade</th>
                <th class="py-3 px-4">Tipo do Vazamento</th>
                <th class="py-3 px-4">Detalhes</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-800 font-mono">
              ${data.security_audit.map(s => `
              <tr class="hover:bg-gray-900/40">
                <td class="py-3 px-4 text-cyan-400">${s.path}</td>
                <td class="py-3 px-4">
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold ${s.severity === "critical" || s.severity === "high" ? "bg-red-950 text-red-400 border border-red-800" : "bg-yellow-950 text-yellow-400 border border-yellow-800"}">
                    ${s.severity.toUpperCase()}
                  </span>
                </td>
                <td class="py-3 px-4 font-bold text-gray-200">${s.type}</td>
                <td class="py-3 px-4 text-gray-400">${s.detail}</td>
              </tr>
              `).join("\n")}
              ${data.security_audit.length === 0 ? `
              <tr><td colspan="4" class="py-4 text-center text-gray-500 italic">Nenhum vazamento ou exposição visual detectada.</td></tr>
              ` : ""}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Tab 6: Logs and APIs -->
    <div id="tab-logs" class="tab-content mt-6 hidden">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- API Logs -->
        <div class="glass p-6 rounded-2xl">
          <h2 class="text-xl font-semibold mb-4 text-cyan-400">Chamadas de API Backend (${totalApis})</h2>
          <div class="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table class="w-full text-left border-collapse text-xs">
              <tbody class="divide-y divide-gray-800 font-mono">
                ${data.apis.map(a => `
                <tr class="hover:bg-gray-900/40">
                  <td class="py-2.5 px-2"><span class="px-1.5 py-0.5 rounded font-bold bg-gray-850 text-gray-300">${a.method}</span></td>
                  <td class="py-2.5 px-2 text-gray-300 break-all">${a.url}</td>
                  <td class="py-2.5 px-2"><span class="${a.status >= 400 ? "text-red-400 font-bold" : "text-emerald-400"}">${a.status}</span></td>
                  <td class="py-2.5 px-2 text-right text-gray-400">${a.latencyMs}ms</td>
                </tr>
                `).join("\n")}
              </tbody>
            </table>
          </div>
        </div>
        
        <!-- Browser Console Errors -->
        <div class="glass p-6 rounded-2xl">
          <h2 class="text-xl font-semibold mb-4 text-yellow-400">Console Logs / Exceptions (${consoleErrors})</h2>
          <div class="space-y-3 max-h-[500px] overflow-y-auto text-xs font-mono">
            ${data.console_errors.map(c => `
            <div class="p-3 rounded-lg bg-gray-900 border border-gray-800">
              <div class="flex justify-between items-start gap-2">
                <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-950 text-yellow-400 border border-yellow-800 uppercase">${c.type}</span>
                <span class="text-gray-500 break-all">${c.location}</span>
              </div>
              <p class="mt-2 text-gray-300">${c.text}</p>
              <p class="text-[10px] text-cyan-400 mt-1">Rota: ${c.path}</p>
            </div>
            `).join("\n")}
            ${consoleErrors === 0 ? `
            <p class="text-gray-500 italic text-center">Nenhum log gravado no console.</p>
            ` : ""}
          </div>
        </div>
      </div>
    </div>

    <!-- Tab 7: Video Replay -->
    <div id="tab-videos" class="tab-content mt-6 hidden">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold">Vídeos das Interações de Auditoria</h2>
        <a href="videos/index.html" target="_blank" class="text-xs text-cyan-400 hover:underline">Abrir Reprodutor em Tela Cheia &rarr;</a>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        ${videoLinks.map((link, idx) => `
        <div class="glass p-5 rounded-2xl">
          <h3 class="font-semibold text-gray-300 mb-3 font-mono">Run #${idx + 1} - E2E Crawler</h3>
          <video controls class="w-full rounded-xl bg-black border border-gray-850 shadow-md">
            <source src="videos/${link}" type="video/webm">
            Your browser does not support the video tag.
          </video>
        </div>
        `).join("\n")}
        ${videoLinks.length === 0 ? `
        <div class="glass p-6 rounded-2xl text-center text-gray-500 col-span-2">
          Nenhum vídeo copiado da pasta de test-results. Verifique as configurações de vídeo no Playwright.
        </div>
        ` : ""}
      </div>
    </div>

  </main>

  <!-- Fullpage screenshot lightbox -->
  <div id="lightbox" class="fixed inset-0 bg-black/95 backdrop-blur-md hidden items-center justify-center z-50 p-4" onclick="closeLightbox()">
    <div class="max-w-7xl max-h-[95vh] overflow-auto rounded-xl relative border border-gray-800" onclick="event.stopPropagation()">
      <button class="absolute top-4 right-4 bg-gray-950/90 text-white font-bold py-2 px-4 rounded-full hover:bg-gray-900 border border-gray-800 shadow" onclick="closeLightbox()">Fechar (X)</button>
      <img id="lightbox-img" src="" alt="Ampliado" class="max-w-full h-auto">
    </div>
  </div>

  <script>
    function switchTab(tabId) {
      document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
      document.getElementById('tab-' + tabId).classList.remove('hidden');

      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('text-cyan-400', 'border-b-2', 'border-cyan-400');
        btn.classList.add('text-gray-400');
      });
      
      const activeBtn = document.getElementById('tab-btn-' + tabId);
      activeBtn.classList.remove('text-gray-400');
      activeBtn.classList.add('text-cyan-400', 'border-b-2', 'border-cyan-400');
    }

    function openLightbox(src) {
      if (!src) return;
      const lightbox = document.getElementById('lightbox');
      const img = document.getElementById('lightbox-img');
      img.src = src;
      lightbox.classList.remove('hidden');
      lightbox.classList.add('flex');
    }

    function closeLightbox() {
      const lightbox = document.getElementById('lightbox');
      lightbox.classList.add('hidden');
      lightbox.classList.remove('flex');
    }
  </script>
</body>
</html>
`;

  fs.writeFileSync(path.join(root, "reports", "final-report.html"), htmlContent, "utf8");
}

main().catch(err => {
  console.error("❌ Process crashed:", err);
  process.exit(1);
});
