import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "../..");

console.log("🧪 [QA Run] Iniciando suíte de testes operacionais e checagem de saúde...");

const report = {
  timestamp: new Date().toISOString(),
  backendHealth: null,
  frontendServed: false,
  websocketRouteOk: false,
  buildSuccess: false,
  testsSuccess: false,
  whatsappSessions: [],
  pagesStatus: {
    Dashboard: "Pendente",
    Inbox: "Pendente",
    Connections: "Pendente",
    Analytics: "Pendente",
    Runtime: "Pendente",
    WebSocket: "Pendente",
    Mapa: "Pendente",
    Performance: "Pendente"
  },
  failures: []
};

// 1. Executar healthcheck do backend
try {
  console.log("➡️ Executando healthcheck interno do backend...");
  const rawHealth = execFileSync("node", [path.join(root, "backend/scripts/healthcheck.js"), "--json"], {
    cwd: path.join(root, "backend"),
    encoding: "utf8"
  });
  report.backendHealth = JSON.parse(rawHealth);
  
  if (report.backendHealth.success) {
    report.pagesStatus.Runtime = "Homologado";
    report.pagesStatus.WebSocket = "Homologado";
    report.pagesStatus.Performance = report.backendHealth.memory?.heap?.status === "ok" ? "Homologado" : "Parcial";
  } else {
    report.pagesStatus.Runtime = "Falha";
    report.pagesStatus.WebSocket = "Falha";
    report.failures.push("Healthcheck do backend retornou falha estrutural.");
  }
} catch (err) {
  console.warn("⚠️ Não foi possível rodar o healthcheck completo do backend (certifique-se de que o banco está rodando).");
  report.failures.push(`Falha ao invocar backend healthcheck: ${err.message}`);
  report.pagesStatus.Runtime = "Falha";
}

// 2. Testar se o frontend está sendo servido
async function checkFrontend() {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = http.get("http://127.0.0.1:8080", { timeout: 3000 }, (res) => {
      report.frontendServed = res.statusCode < 400;
      console.log(`✅ Frontend servido: HTTP ${res.statusCode} em ${Date.now() - start}ms`);
      report.pagesStatus.Dashboard = "Homologado";
      report.pagesStatus.Mapa = "Homologado";
      resolve();
    });
    req.on("error", (err) => {
      report.frontendServed = false;
      report.failures.push(`Frontend não responde em localhost:8080: ${err.message}`);
      report.pagesStatus.Dashboard = "Falha";
      resolve();
    });
    req.on("timeout", () => {
      req.destroy();
      report.frontendServed = false;
      report.failures.push("Timeout ao conectar no Frontend (8080)");
      report.pagesStatus.Dashboard = "Falha";
      resolve();
    });
  });
}

// 3. Testar conexão polling do WebSocket
async function checkWebSocketProbe() {
  return new Promise((resolve) => {
    const req = http.get("http://127.0.0.1:4025/socket.io/?EIO=4&transport=polling", { timeout: 3000 }, (res) => {
      report.websocketRouteOk = res.statusCode === 200;
      console.log(`✅ WebSocket handshake probe: HTTP ${res.statusCode}`);
      resolve();
    });
    req.on("error", (err) => {
      report.websocketRouteOk = false;
      report.failures.push(`Falha no handshake do Socket.IO: ${err.message}`);
      resolve();
    });
  });
}

// 4. Executar build do frontend
function checkBuild() {
  console.log("➡️ Executando build de produção do frontend (npm run build)...");
  try {
    execSync("npm run build", {
      cwd: path.join(root, "frontend-official"),
      stdio: "inherit"
    });
    report.buildSuccess = true;
    console.log("✅ Build de produção compilado com sucesso.");
  } catch (err) {
    report.buildSuccess = false;
    report.failures.push(`Build do frontend falhou: ${err.message}`);
    console.error("❌ Falha na compilação de build.");
  }
}

// 5. Executar testes do frontend
function checkTests() {
  console.log("➡️ Executando testes unitários do frontend (npm run test)...");
  try {
    execSync("npm run test", {
      cwd: path.join(root, "frontend-official"),
      stdio: "inherit"
    });
    report.testsSuccess = true;
    console.log("✅ Todos os testes passaram.");
  } catch (err) {
    report.testsSuccess = false;
    report.failures.push(`Testes unitários falharam: ${err.message}`);
    console.error("❌ Falha na suíte de testes.");
  }
}

// 6. Ler sessões do WhatsApp
function checkWhatsAppSessions() {
  const sessionsDir = path.join(root, "backend/sessions");
  if (!fs.existsSync(sessionsDir)) return;
  try {
    const entries = fs.readdirSync(sessionsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === ".gitkeep") continue;
      const credsPath = path.join(sessionsDir, entry.name, "creds.json");
      const hasAuth = fs.existsSync(credsPath);
      report.whatsappSessions.push({
        id: entry.name,
        hasAuth,
        status: hasAuth ? "Pre-authenticated" : "No credentials"
      });
    }
    
    if (report.whatsappSessions.length > 0) {
      report.pagesStatus.Connections = "Homologado";
      report.pagesStatus.Inbox = "Homologado";
      report.pagesStatus.Analytics = "Homologado";
    } else {
      report.pagesStatus.Connections = "Parcial (sem sessões criadas)";
      report.pagesStatus.Inbox = "Parcial (sem sessões criadas)";
    }
  } catch (err) {
    report.failures.push(`Falha ao ler diretório de sessões: ${err.message}`);
  }
}

// 6. Executar crawler E2E Playwright (Mapeamento e Auditoria Completa)
function checkE2EDiscovery() {
  console.log("➡️ Executando crawler E2E Playwright (Mapeamento e Auditoria)...");
  try {
    execSync("npx playwright test tests/ui/discovery-crawler.spec.ts", {
      cwd: path.join(root, "frontend-official"),
      stdio: "inherit"
    });
    report.e2eDiscoverySuccess = true;
    console.log("✅ Mapeamento E2E concluído com sucesso.");
  } catch (err) {
    report.e2eDiscoverySuccess = false;
    report.failures.push(`Falha no crawler E2E Playwright: ${err.message}`);
    console.error("❌ Falha no crawler E2E.");
  }
}

async function run() {
  await checkFrontend();
  await checkWebSocketProbe();
  checkWhatsAppSessions();
  checkBuild();
  checkTests();
  checkE2EDiscovery();

  // Escrever relatório final em JSON
  const reportPath = path.join(root, "qa-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n💾 Relatório salvo em: ${reportPath}`);

  // Gerar versão markdown amigável
  const mdPath = path.join(root, "qa-report.md");
  const mdContent = `
# Relatório de Garantia de Qualidade (QA) - ZAPFLOW AI
**Executado em:** ${new Date(report.timestamp).toLocaleString("pt-BR")}

## 📊 Resumo Executivo
* **Frontend Servido (8080):** ${report.frontendServed ? "✅ ONLINE" : "❌ OFFLINE"}
* **WebSocket Handshake (4025):** ${report.websocketRouteOk ? "✅ ONLINE" : "❌ FALHA"}
* **Build de Produção:** ${report.buildSuccess ? "✅ COMPILADO" : "❌ FALHA DE COMPILAÇÃO"}
* **Testes Unitários:** ${report.testsSuccess ? "✅ PASSARAM" : "❌ FALHAS DETECTADAS"}
* **Auditoria E2E (Crawler):** ${report.e2eDiscoverySuccess ? "✅ CONCLUÍDO (Veja [discovery-report.md](file:///c:/projetos/ZAPAI-FINAL/tests/discovery-report.md))" : "❌ FALHA NA EXECUÇÃO"}

## 🗺️ Homologação de Páginas / Recursos
${Object.entries(report.pagesStatus).map(([page, status]) => `- **${page}:** ${status === "Homologado" ? "🟢 Homologado" : status.startsWith("Parcial") ? "🟡 Parcial" : "🔴 Falha"}`).join("\n")}

## 🔌 Sessões WhatsApp Detectadas localmente
${report.whatsappSessions.length === 0 ? "_Nenhuma sessão de WhatsApp criada no disco ainda._" : report.whatsappSessions.map((s) => `- Sessão \`${s.id}\`: status=${s.status} (autenticação=${s.hasAuth})`).join("\n")}

## 🚨 Falhas / Alertas Registrados
${report.failures.length === 0 ? "_Nenhum erro grave detectado._" : report.failures.map((f) => `- ${f}`).join("\n")}

---
Relatório gerado automaticamente pela suíte de QA oficial do Zapflow.
`;
  fs.writeFileSync(mdPath, mdContent);
  console.log(`📝 Relatório legível salvo em: ${mdPath}\n`);

  console.log("──────────────────────────────────────────────────");
  if (report.failures.length === 0 && report.buildSuccess && report.testsSuccess && report.e2eDiscoverySuccess) {
    console.log("🟢 SUÍTE DE QA CONCLUÍDA COM SUCESSO! SISTEMA ESTÁVEL.");
  } else {
    console.warn(`🔴 SUÍTE DE QA CONCLUÍDA COM ${report.failures.length} ALERTA(S)/FALHA(S).`);
  }
  console.log("──────────────────────────────────────────────────\n");
}

run();
