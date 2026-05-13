const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.join(__dirname, "..");
const SRC_DIR = path.join(PROJECT_ROOT, "src");
const APP_FILE = path.join(SRC_DIR, "App.tsx");

const FORBIDDEN_TOKENS = [
  "ZAPAI-CRM",
  "swift-wa-assist",
  "master-node",
  "legacy-frontend-candidates",
  "archive/source-repositories",
];

const OFFICIAL_ROUTES = new Set([
  "/",
  "/dashboard",
  "/connections",
  "/inbox",
  "/contacts",
  "/ai",
  "/flows",
  "/campaigns",
  "/diagnostics",
  "/settings",
  "/admin/master",
  "*",
]);

function getAllFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...getAllFiles(full));
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function fail(message) {
  console.error(`[UI-GUARD] FAIL: ${message}`);
  process.exitCode = 1;
}

function ok(message) {
  console.log(`[UI-GUARD] OK: ${message}`);
}

const sourceFiles = getAllFiles(SRC_DIR);
let violations = 0;

for (const file of sourceFiles) {
  const rel = path.relative(PROJECT_ROOT, file);
  const content = fs.readFileSync(file, "utf8");

  for (const token of FORBIDDEN_TOKENS) {
    if (content.includes(token)) {
      violations += 1;
      fail(`${rel} referencia fonte legada: ${token}`);
    }
  }
}

ok("Nenhuma referencia direta a fontes legadas detectada em src/");

if (!fs.existsSync(APP_FILE)) {
  violations += 1;
  fail("App.tsx nao encontrado");
} else {
  const appContent = fs.readFileSync(APP_FILE, "utf8");
  const routeRegex = /path="([^"]+)"/g;
  const routeSet = new Set();

  for (const match of appContent.matchAll(routeRegex)) {
    routeSet.add(match[1]);
  }

  for (const route of routeSet) {
    if (!OFFICIAL_ROUTES.has(route)) {
      violations += 1;
      fail(`Rota fora do freeze visual detectada: ${route}`);
    }
  }

  for (const route of OFFICIAL_ROUTES) {
    if (!routeSet.has(route)) {
      violations += 1;
      fail(`Rota oficial ausente no App.tsx: ${route}`);
    }
  }

  if (violations === 0) {
    ok(`Rotas oficiais fixadas (${Array.from(routeSet).sort().join(", ")})`);
  }
}

if (violations > 0) {
  console.error(`[UI-GUARD] Encontradas ${violations} violacoes.`);
  process.exit(1);
}

ok("Freeze visual validado com sucesso.");
