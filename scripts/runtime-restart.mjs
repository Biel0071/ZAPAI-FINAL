import { cleanRuntimeArtifacts, formatProcessSummary, officialPorts, startOfficialRuntime, stopManagedProcesses, waitForHttp } from "./runtime-lib.mjs";

const shouldClean = process.argv.includes("--clean");
const stopResult = stopManagedProcesses();
const removed = shouldClean ? cleanRuntimeArtifacts() : [];
const started = startOfficialRuntime();

console.log("[runtime:restart] Processos encerrados:");
console.log(formatProcessSummary(stopResult.killed));
if (shouldClean) {
  console.log(`[runtime:restart] Artefatos limpos: ${removed.length > 0 ? removed.join(", ") : "nenhum"}`);
}
console.log(`[runtime:restart] Backend iniciado com PID ${started.backendPid}.`);
console.log(`[runtime:restart] Frontend iniciado com PID ${started.frontendPid}.`);

const [backendStatus, frontendStatus] = await Promise.all([
  waitForHttp(`http://127.0.0.1:${officialPorts.backend}/health`, 30000),
  waitForHttp(`http://127.0.0.1:${officialPorts.frontend}`, 30000),
]);

if (stopResult.failed.length > 0 || !backendStatus.ok || !frontendStatus.ok) {
  if (stopResult.failed.length > 0) {
    console.error("[runtime:restart] Alguns processos não puderam ser encerrados:");
    for (const entry of stopResult.failed) {
      console.error(`- PID ${entry.proc.pid}: ${entry.error}`);
    }
  }
  console.error(`- backend: ${backendStatus.ok ? "ok" : backendStatus.error}`);
  console.error(`- frontend: ${frontendStatus.ok ? "ok" : frontendStatus.error}`);
  process.exitCode = 1;
} else {
  console.log(`[runtime:restart] Runtime oficial reiniciado em http://127.0.0.1:${officialPorts.frontend} com backend em http://127.0.0.1:${officialPorts.backend}.`);
}
