import fs from "node:fs";
import path from "node:path";

const REQUIRED_ENDPOINTS = ["/api/health", "/api/conversations"];

function readDotEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return {};

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  const entries = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    const value = rest.join("=").trim().replace(/^['\"]|['\"]$/g, "");
    entries[key.trim()] = value;
  }
  return entries;
}

function resolveBaseApiUrl() {
  const envFile = readDotEnv();
  const configured = process.env.VITE_API_URL || envFile.VITE_API_URL || "";
  const normalized = String(configured).trim().replace(/\/$/, "");
  return /^https?:\/\//i.test(normalized) ? normalized : "";
}

function ensureMandatoryConfig(baseApiUrl) {
  if (!baseApiUrl) {
    throw new Error("Base URL inválida: defina VITE_API_URL com http:// ou https://");
  }
}

async function main() {
  const baseApiUrl = resolveBaseApiUrl();
  ensureMandatoryConfig(baseApiUrl);

  const results = await Promise.all(
    REQUIRED_ENDPOINTS.map(async (endpoint) => {
      const url = endpoint.startsWith("/api/")
        ? `${baseApiUrl.replace(/\/api$/i, "")}${endpoint}`
        : `${baseApiUrl}${endpoint}`;

      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "x-tenant-id": "main",
          },
        });

        return { endpoint, ok: response.ok, status: response.status };
      } catch {
        return { endpoint, ok: false, status: "network_error" };
      }
    }),
  );

  const failed = results.filter((item) => !item.ok);
  if (failed.length > 0) {
    console.error("\n⛔ Publish bloqueado: endpoints obrigatórios indisponíveis.\n");
    failed.forEach((item) => {
      console.error(`- ${item.endpoint}: ${item.status}`);
    });
    process.exit(1);
  }

  console.log("\n✅ API check aprovado: /api/health e /api/conversations online.\n");
}

main().catch((error) => {
  console.error("\n⛔ Publish bloqueado por erro no check de API.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
