import {
  cleanRuntimeArtifacts,
  formatProcessSummary,
  officialPorts,
  startOfficialRuntime,
  stopManagedProcesses,
  waitForHttp,
} from "./runtime-lib.mjs";

const stopped = stopManagedProcesses();
if (stopped.killed.length > 0) {
  console.log("[runtime:start] Processos encerrados:");
  console.log(formatProcessSummary(stopped.killed));
}
if (stopped.failed.length > 0) {
  console.warn("[runtime:start] Falhas ao encerrar alguns processos:");
  for (const failure of stopped.failed) {
    console.warn(`- PID ${failure.proc.pid}: ${failure.error}`);
  }
}

const removed = cleanRuntimeArtifacts();
if (removed.length > 0) {
  console.log(`[runtime:start] Artefatos limpos: ${removed.join(", ")}`);
}

const started = startOfficialRuntime();
console.log(`[runtime:start] Backend iniciado com PID ${started.backendPid}.`);
console.log(`[runtime:start] Frontend iniciado com PID ${started.frontendPid}.`);

const [backendStatus, frontendStatus] = await Promise.all([
  waitForHttp(`http://127.0.0.1:${officialPorts.backend}/health`, 30000),
  waitForHttp(`http://127.0.0.1:${officialPorts.frontend}`, 30000),
]);

if (!backendStatus.ok || !frontendStatus.ok) {
  console.error("[runtime:start] Runtime não ficou saudável dentro do timeout.");
  console.error(`- backend: ${backendStatus.ok ? "ok" : backendStatus.error}`);
  console.error(`- frontend: ${frontendStatus.ok ? "ok" : frontendStatus.error}`);
  process.exitCode = 1;
} else {
  console.log(`[runtime:start] Runtime oficial ativo em http://127.0.0.1:${officialPorts.frontend} com backend em http://127.0.0.1:${officialPorts.backend}.`);
}
