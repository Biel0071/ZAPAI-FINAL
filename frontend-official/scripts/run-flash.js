const { spawn } = require('child_process');

console.log("⚡ INICIANDO FLASH TEST: Chaos UI + API Flood ⚡\n");

const ui = spawn('npm', ['run', 'test:chaos'], { stdio: 'inherit', shell: true });
const api = spawn('node', ['../backend/scripts/fast-api-flood.js'], { stdio: 'inherit', shell: true });

let completed = 0;

function checkDone() {
  completed++;
  if (completed === 2) {
    console.log("\n✅ Teste Flash Finalizado! Rodando Análise...");
    const analyze = spawn('npm', ['run', 'test:analyze'], { stdio: 'inherit', shell: true });
    analyze.on('close', (code) => {
      console.log(`\nFim de Execução. (Code: ${code})`);
      process.exit(code);
    });
  }
}

ui.on('close', checkDone);
api.on('close', checkDone);
