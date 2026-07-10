import fs from "node:fs";
import path from "node:path";
import { execFileSync, execSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const repoRoot = path.resolve(__dirname, "..");
export const logsDir = path.join(repoRoot, "logs");
export const frontendDir = path.join(repoRoot, "frontend-official");
export const backendDir = path.join(repoRoot, "backend");
export const targetPorts = [3000, 4025, 4173, 5173, 8080];
export const officialPorts = {
  backend: 4025,
  frontend: 8080,
};

const duplicateCommandFragments = [
  "frontend-official",
  "vite preview",
  `${path.sep}backend${path.sep}`,
  "swift-wa-assist-live-integration",
  `${path.sep}swift-wa-assist${path.sep}`,
];

function isWindows() {
  return process.platform === "win32";
}


function safeTrim(value) {
  return String(value ?? "").trim();
}

function normalizeCommandLine(commandLine) {
  return safeTrim(commandLine).replaceAll("\\", "/").toLowerCase();
}

function shouldManageProcess(commandLine) {
  const normalized = normalizeCommandLine(commandLine);
  if (!normalized) return false;

  return duplicateCommandFragments.some((fragment) => normalized.includes(fragment.replaceAll("\\", "/").toLowerCase()));
}

export function ensureLogsDir() {
  fs.mkdirSync(logsDir, { recursive: true });
}

export function getRunningProcesses() {
  if (isWindows()) {
    const myPid = process.pid;
    const myPpid = process.ppid;
    const script = [
      "$ErrorActionPreference = 'SilentlyContinue'",
      "$listeningPids = Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 3000,4025,4173,5173,8080 } | Select-Object -ExpandProperty OwningProcess",
      `$procs = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*frontend-official*' -or $_.CommandLine -like '*vite*' -or $_.CommandLine -like '*backend*' -or $_.CommandLine -like '*swift-wa-assist*' -or $_.ProcessId -in @($listeningPids) -or $_.ProcessId -eq ${myPid} -or $_.ProcessId -eq ${myPpid} } | Select-Object ProcessId,ParentProcessId,Name,CommandLine`,
      "ConvertTo-Json -InputObject @($procs) -Depth 3 -Compress",
    ].join("; ");

    let raw = "";
    try {
      raw = execFileSync("powershell.exe", ["-NoProfile", "-Command", script], {
        cwd: repoRoot,
        encoding: "utf8",
      });
    } catch {
      let tasklist = "";
      try {
        tasklist = execFileSync("tasklist.exe", ["/FO", "CSV", "/NH"], {
          cwd: repoRoot,
          encoding: "utf8",
        });
      } catch {
        return [
          {
            pid: process.pid,
            ppid: process.ppid,
            name: path.basename(process.execPath),
            commandLine: process.argv.join(" "),
          },
        ];
      }

      return tasklist
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const columns = line
            .match(/("([^"]|"")*"|[^,]+)/g)
            ?.map((value) => value.replace(/^"|"$/g, "").replaceAll('""', '"')) || [];
          const name = columns[0] || "";
          const pid = Number(columns[1]);
          return {
            pid,
            ppid: Number.NaN,
            name: safeTrim(name),
            commandLine: "",
          };
        })
        .filter((item) => Number.isFinite(item.pid));
    }

    const trimmed = raw.trim();
    const cleaned = trimmed.replace(/[\x00-\x1F]/g, (m) => m === '\n' ? '\\n' : m === '\r' ? '\\r' : m === '\t' ? '\\t' : '');
    const parsed = JSON.parse(cleaned || "[]");
    return (Array.isArray(parsed) ? parsed : [parsed])
      .map((item) => ({
        pid: Number(item.ProcessId),
        ppid: Number(item.ParentProcessId),
        name: safeTrim(item.Name),
        commandLine: safeTrim(item.CommandLine),
      }))
      .filter((item) => Number.isFinite(item.pid));
  }

  const raw = execSync("ps -ax -o pid=,comm=,args=", {
    cwd: repoRoot,
    encoding: "utf8",
  });

  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)\s+(\S+)\s*(.*)$/);
      if (!match) return null;
      return {
        pid: Number(match[1]),
        ppid: Number.NaN,
        name: safeTrim(match[2]),
        commandLine: safeTrim(match[3]),
      };
    })
    .filter(Boolean);
}

export function getListeningPorts() {
  if (isWindows()) {
    const script = [
      "$ErrorActionPreference = 'Stop'",
      "$ports = Get-NetTCPConnection -State Listen | Select-Object LocalPort,OwningProcess",
      "ConvertTo-Json -InputObject @($ports) -Depth 3 -Compress",
    ].join("; ");

    let raw = "";
    try {
      raw = execFileSync("powershell.exe", ["-NoProfile", "-Command", script], {
        cwd: repoRoot,
        encoding: "utf8",
      });
    } catch {
      let netstat = "";
      try {
        netstat = execFileSync("netstat.exe", ["-ano", "-p", "TCP"], {
          cwd: repoRoot,
          encoding: "utf8",
        });
      } catch {
        return [];
      }

      return netstat
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => /\bLISTENING\b/i.test(line))
        .map((line) => {
          const parts = line.split(/\s+/);
          const localAddress = parts[1] || "";
          const pid = Number(parts.at(-1));
          const port = Number(localAddress.split(":").at(-1));
          return { pid, port };
        })
        .filter((item) => Number.isFinite(item.port) && Number.isFinite(item.pid));
    }

    const trimmed = raw.trim();
    const cleaned = trimmed.replace(/[\x00-\x1F]/g, (m) => m === '\n' ? '\\n' : m === '\r' ? '\\r' : m === '\t' ? '\\t' : '');
    const parsed = JSON.parse(cleaned || "[]");
    return (Array.isArray(parsed) ? parsed : [parsed])
      .map((item) => ({
        port: Number(item.LocalPort),
        pid: Number(item.OwningProcess),
      }))
      .filter((item) => Number.isFinite(item.port) && Number.isFinite(item.pid));
  }

  const raw = execSync("lsof -nP -iTCP -sTCP:LISTEN", {
    cwd: repoRoot,
    encoding: "utf8",
  });

  return raw
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+/);
      const pid = Number(parts[1]);
      const address = parts[8] || "";
      const port = Number(address.split(":").at(-1));
      return { pid, port };
    })
    .filter((item) => Number.isFinite(item.port) && Number.isFinite(item.pid));
}

function getProtectedPids(processes) {
  const protectedPids = new Set([process.pid, process.ppid]);
  const parentByPid = new Map(processes.map((proc) => [proc.pid, proc.ppid]));

  let cursor = process.ppid;
  while (Number.isFinite(cursor) && cursor > 0 && !protectedPids.has(cursor)) {
    protectedPids.add(cursor);
    cursor = parentByPid.get(cursor);
  }

  return protectedPids;
}

export function discoverManagedProcesses() {
  const processes = getRunningProcesses();
  const protectedPids = getProtectedPids(processes);
  const portMap = new Map();

  for (const entry of getListeningPorts()) {
    if (!targetPorts.includes(entry.port)) continue;
    const ports = portMap.get(entry.pid) ?? new Set();
    ports.add(entry.port);
    portMap.set(entry.pid, ports);
  }

  const managed = processes
    .filter((proc) => !protectedPids.has(proc.pid))
    .filter((proc) => shouldManageProcess(proc.commandLine) || portMap.has(proc.pid))
    .map((proc) => ({
      ...proc,
      ports: Array.from(portMap.get(proc.pid) ?? []).sort((a, b) => a - b),
    }))
    .sort((a, b) => {
      const aPriority = a.ports.length > 0 ? 0 : 1;
      const bPriority = b.ports.length > 0 ? 0 : 1;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return a.pid - b.pid;
    });

  const deduped = new Map();
  for (const proc of managed) {
    deduped.set(proc.pid, proc);
  }
  return Array.from(deduped.values()).sort((a, b) => a.pid - b.pid);
}

export function formatProcessSummary(processes) {
  if (processes.length === 0) {
    return "Nenhum runtime gerenciado encontrado.";
  }

  return processes
    .map((proc) => {
      const ports = proc.ports.length > 0 ? ` [ports: ${proc.ports.join(", ")}]` : "";
      return `- PID ${proc.pid} ${proc.name}${ports} :: ${proc.commandLine}`;
    })
    .join("\n");
}

function processExists(pid) {
  if (!Number.isFinite(pid) || pid <= 0) return false;

  if (isWindows()) {
    const script = [
      "$ErrorActionPreference = 'Stop'",
      `$proc = Get-CimInstance Win32_Process -Filter \"ProcessId = ${pid}\"`,
      "if ($proc) { 'true' } else { 'false' }",
    ].join("; ");

    try {
      const raw = execFileSync("powershell.exe", ["-NoProfile", "-Command", script], {
        stdio: ["ignore", "pipe", "ignore"],
        encoding: "utf8",
      });
      return safeTrim(raw) === "true";
    } catch {
      return false;
    }
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function killProcessTree(pid) {
  if (!Number.isFinite(pid) || pid <= 0) return;

  if (isWindows()) {
    try {
      execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
        stdio: "ignore",
      });
    } catch (error) {
      if (processExists(pid)) {
        throw error;
      }
    }
    return;
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch (error) {
    if (processExists(pid)) {
      throw error;
    }
  }
}

export function stopManagedProcesses() {
  const managed = discoverManagedProcesses();
  const killed = [];
  const failed = [];

  for (const proc of managed) {
    try {
      killProcessTree(proc.pid);
      killed.push(proc);
    } catch (error) {
      failed.push({ proc, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return { managed, killed, failed };
}

export function removePath(targetPath) {
  if (!fs.existsSync(targetPath)) return false;
  fs.rmSync(targetPath, { recursive: true, force: true });
  return true;
}

export function cleanRuntimeArtifacts() {
  const removed = [];
  const cleanDependencyCache = String(process.env.RUNTIME_CLEAN_DEP_CACHE || "").toLowerCase() === "true";
  const candidates = [
    path.join(repoRoot, "playwright-report"),
    path.join(repoRoot, "test-results"),
    path.join(repoRoot, "coverage"),
    path.join(logsDir, "local-backend.log"),
    path.join(logsDir, "local-frontend.log"),
  ];

  if (cleanDependencyCache) {
    candidates.push(
      path.join(frontendDir, "dist"),
      path.join(frontendDir, "node_modules", ".vite"),
    );
  }

  for (const candidate of candidates) {
    if (removePath(candidate)) {
      removed.push(path.relative(repoRoot, candidate));
    }
  }

  return removed;
}

export function spawnDetached(command, args, options = {}) {
  ensureLogsDir();
  const stdoutPath = options.stdoutPath || path.join(logsDir, `${options.name || "process"}.log`);
  const stderrPath = options.stderrPath || stdoutPath;
  const stdout = fs.openSync(stdoutPath, "a");
  const stderr = fs.openSync(stderrPath, "a");

  const child = spawn(command, args, {
    cwd: options.cwd || repoRoot,
    detached: true,
    stdio: ["ignore", stdout, stderr],
    windowsHide: true,
    env: {
      ...process.env,
      FORCE_COLOR: "0",
      ...(options.env || {}),
    },
  });

  child.unref();
  return child.pid;
}

export function startOfficialRuntime() {
  ensureLogsDir();

  const nodeVersion = process.version;
  const match = nodeVersion.match(/^v(\d+)\.(\d+)\./);
  const major = match ? parseInt(match[1], 10) : 0;
  const minor = match ? parseInt(match[2], 10) : 0;

  const backendArgs = [];
  if (major > 22 || major === 22 || (major === 20 && minor >= 17)) {
    backendArgs.push("--experimental-require-module");
  }
  backendArgs.push(path.join(backendDir, "server.js"));

  const backendPid = spawnDetached(
    process.execPath,
    backendArgs,
    {
      name: "local-backend",
      cwd: backendDir,
      stdoutPath: path.join(logsDir, "local-backend.log"),
      env: {
        NODE_ENV: "development",
        PORT: String(officialPorts.backend),
        FRONTEND_URL: `http://127.0.0.1:${officialPorts.frontend}`,
        MASTER_API_URL: `http://127.0.0.1:${officialPorts.backend}`,
        METRICS_TRACKING_INTERVAL_MS: process.env.METRICS_TRACKING_INTERVAL_MS || "120000",
        RUNTIME_HEARTBEAT_MS: process.env.RUNTIME_HEARTBEAT_MS || "60000",
        RUNTIME_CLEANUP_MS: process.env.RUNTIME_CLEANUP_MS || "180000",
        RUNTIME_METRICS_EMIT_MS: process.env.RUNTIME_METRICS_EMIT_MS || "120000",
        RUNTIME_DIAGNOSTICS_MS: process.env.RUNTIME_DIAGNOSTICS_MS || "180000",
        WORKER_HEARTBEAT_STALE_MS: process.env.WORKER_HEARTBEAT_STALE_MS || "300000",
        AI_MEMORY_FLUSH_MS: process.env.AI_MEMORY_FLUSH_MS || "900000",
        AI_MEMORY_FLUSH_BATCH_SIZE: process.env.AI_MEMORY_FLUSH_BATCH_SIZE || "20",
        SESSION_WATCHDOG_MS: process.env.SESSION_WATCHDOG_MS || "180000",
      },
    },
  );

  const frontendPid = spawnDetached(
    process.execPath,
    [
      path.join(frontendDir, "node_modules", "vite", "bin", "vite.js"),
      "--host",
      "0.0.0.0",
      "--port",
      String(officialPorts.frontend),
    ],
    {
      name: "local-frontend",
      cwd: frontendDir,
      stdoutPath: path.join(logsDir, "local-frontend.log"),
      env: {
        NODE_ENV: "development",
        PORT: String(officialPorts.frontend),
      },
    },
  );

  return { backendPid, frontendPid };
}

export async function waitForHttp(url, timeoutMs = 30000) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json,text/html" },
      });
      if (response.ok) {
        return { ok: true, status: response.status };
      }
      lastError = new Error(`HTTP ${response.status} for ${url}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return {
    ok: false,
    status: 0,
    error: lastError instanceof Error ? lastError.message : String(lastError ?? "timeout"),
  };
}
