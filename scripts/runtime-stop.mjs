import { formatProcessSummary, stopManagedProcesses } from "./runtime-lib.mjs";

const result = stopManagedProcesses();

console.log("[runtime:stop] Processos gerenciados detectados:");
console.log(formatProcessSummary(result.managed));

if (result.failed.length > 0) {
  console.error("[runtime:stop] Falhas ao encerrar alguns processos:");
  for (const entry of result.failed) {
    console.error(`- PID ${entry.proc.pid}: ${entry.error}`);
  }
  process.exitCode = 1;
} else {
  console.log(`[runtime:stop] ${result.killed.length} processo(s) encerrado(s).`);
}
