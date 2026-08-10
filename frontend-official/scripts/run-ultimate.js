const { spawn } = require('child_process');

console.log("🏆 INICIANDO ULTIMATE TEST: Nível 3 Jornada Real E2E 🏆\n");

const ui = spawn('npm', ['run', 'test:ultimate-playwright'], { stdio: 'inherit', shell: true });

ui.on('close', (code) => {
  console.log(`\n✅ Teste Ultimate Finalizado! Rodando Análise para Fila de Bugs...`);
  const analyze = spawn('npm', ['run', 'test:analyze'], { stdio: 'inherit', shell: true });
  analyze.on('close', (analyzeCode) => {
    console.log(`\nFim de Execução. (Code: ${analyzeCode})`);
    process.exit(code || analyzeCode);
  });
});
