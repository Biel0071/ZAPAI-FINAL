import { cleanRuntimeArtifacts, formatProcessSummary, startOfficialRuntime, stopManagedProcesses, waitForHttp, officialPorts } from "./runtime-lib.mjs";

const shouldStart = process.argv.includes("--start");
const stopResult = stopManagedProcesses();
const removed = cleanRuntimeArtifacts();

console.log("[runtime:clean] Processos encerrados:");
console.log(formatProcessSummary(stopResult.killed));
console.log(`[runtime:clean] Artefatos removidos: ${removed.length > 0 ? removed.join(", ") : "nenhum"}`);

if (stopResult.failed.length > 0) {
  console.error("[runtime:clean] Alguns processos não puderam ser encerrados:");
  for (const entry of stopResult.failed) {
    console.error(`- PID ${entry.proc.pid}: ${entry.error}`);
  }
  process.exitCode = 1;
}

if (shouldStart) {
  const started = startOfficialRuntime();
  console.log(`[runtime:clean] Backend iniciado com PID ${started.backendPid}.`);
  console.log(`[runtime:clean] Frontend iniciado com PID ${started.frontendPid}.`);

  const [backendStatus, frontendStatus] = await Promise.all([
    waitForHttp(`http://127.0.0.1:${officialPorts.backend}/health`, 30000),
    waitForHttp(`http://127.0.0.1:${officialPorts.frontend}`, 30000),
  ]);

  if (!backendStatus.ok || !frontendStatus.ok) {
    console.error("[runtime:clean] Runtime subiu parcialmente.");
    console.error(`- backend: ${backendStatus.ok ? "ok" : backendStatus.error}`);
    console.error(`- frontend: ${frontendStatus.ok ? "ok" : frontendStatus.error}`);
    process.exitCode = 1;
  } else {
    console.log(`[runtime:clean] Runtime oficial disponível em http://127.0.0.1:${officialPorts.frontend} com backend http://127.0.0.1:${officialPorts.backend}.`);
  }
}
