import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "../..");

console.log("♻️ [Dev Restart] Reiniciando runtime oficial do Zapflow AI...");

const proc = spawn("node", [path.join(root, "scripts/runtime-restart.mjs")], {
  cwd: root,
  stdio: "inherit"
});

proc.on("exit", (code) => {
  process.exit(code ?? 0);
});
