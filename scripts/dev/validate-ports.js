import { execFileSync } from "node:child_process";

const portsToCheck = [8080, 4025];

function isWindows() {
  return process.platform === "win32";
}

function checkPortsWindows() {
  console.log("🔍 [Validate Ports] Verificando portas no Windows...");
  const script = [
    "$ErrorActionPreference = 'SilentlyContinue'",
    "$connections = Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 8080,4025 }",
    "if ($connections) {",
    "  $connections | ForEach-Object {",
    "    $process = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue",
    "    $cmd = (Get-CimInstance Win32_Process -Filter \"ProcessId = $($_.OwningProcess)\").CommandLine",
    "    [PSCustomObject]@{ Port = $_.LocalPort; PID = $_.OwningProcess; ProcessName = $process.Name; CommandLine = $cmd }",
    "  } | ConvertTo-Json -Compress",
    "} else { '[]' }"
  ].join("; ");

  try {
    const raw = execFileSync("powershell.exe", ["-NoProfile", "-Command", script], { encoding: "utf8" });
    const trimmed = raw.trim();
    if (!trimmed || trimmed === "[]") {
      console.log("✅ Nenhuma das portas (8080, 4025) está ocupada.");
      return;
    }
    const parsed = JSON.parse(trimmed);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    console.warn("⚠️ Portas ocupadas encontradas:");
    for (const item of list) {
      console.warn(`- Porta ${item.Port} ocupada pelo PID ${item.PID} (${item.ProcessName})`);
      console.warn(`  Comando: ${item.CommandLine || "N/A"}`);
    }
  } catch (error) {
    console.error("❌ Erro ao validar portas via PowerShell:", error.message);
  }
}

function checkPortsUnix() {
  console.log("🔍 [Validate Ports] Verificando portas no Unix...");
  try {
    const raw = execFileSync("lsof", ["-i", ":8080,:4025", "-t"], { encoding: "utf8" });
    const pids = raw.trim().split("\n").filter(Boolean);
    if (pids.length === 0) {
      console.log("✅ Nenhuma das portas (8080, 4025) está ocupada.");
      return;
    }
    console.warn(`⚠️ PIDs ocupando as portas: ${pids.join(", ")}`);
    for (const pid of pids) {
      const details = execFileSync("ps", ["-p", pid, "-o", "pid,command"], { encoding: "utf8" });
      console.warn(details.trim());
    }
  } catch {
    console.log("✅ Nenhuma das portas (8080, 4025) está ocupada.");
  }
}

function main() {
  if (isWindows()) {
    checkPortsWindows();
  } else {
    checkPortsUnix();
  }
}

main();
