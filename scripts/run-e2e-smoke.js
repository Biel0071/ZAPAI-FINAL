/**
 * ZAPFLOW AI — Fast Headless E2E Synthetic Smoke Test Runner (CLI)
 * Executável via: npm run test:e2e  ou  node scripts/run-e2e-smoke.js
 */

const http = require('http');

const API_HOST = process.env.API_HOST || '127.0.0.1';
const API_PORT = process.env.API_PORT || 4025;

console.log('\n============================================================');
console.log('  ⚡ ZAPFLOW AI — SUÍTE DE TESTES AUTOMATIZADOS E2E (HEADLESS)');
console.log('============================================================\n');

async function runLocalSuite() {
  try {
    const { executeFullE2ESmokeSuite } = require('../backend/services/e2eSmokeRunner');
    console.log('Running internal backend test suite directly...\n');
    const report = await executeFullE2ESmokeSuite();
    printReport(report);
  } catch (err) {
    console.log('Calling live API endpoint http://' + API_HOST + ':' + API_PORT + '/api/system/e2e-smoke...\n');
    callApiSuite();
  }
}

function callApiSuite() {
  const req = http.request(
    {
      hostname: API_HOST,
      port: API_PORT,
      path: '/api/system/e2e-smoke',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          if (parsed.data) {
            printReport(parsed.data);
          } else {
            console.error('API Error Response:', parsed);
          }
        } catch (e) {
          console.error('Failed to parse API output:', raw);
        }
      });
    }
  );

  req.on('error', (e) => {
    console.error('❌ Connection error to backend:', e.message);
    process.exit(1);
  });

  req.end();
}

function printReport(report) {
  console.log(`⏱️ Data/Hora: ${report.timestamp}`);
  console.log(`📊 Score de Saúde: ${report.healthScore}% (${report.passedCount}/${report.totalCount} nós aprovados)`);
  console.log(`⚡ Tempo Total: ${report.totalDurationMs}ms\n`);

  console.log('--- GRAFO DE NÓS DE TESTES ---');
  (report.nodes || []).forEach((node, i) => {
    const icon = node.status === 'healthy' ? '✅' : '❌';
    console.log(`${icon} [Nó ${i + 1}/${report.totalCount}] ${node.name} (${node.durationMs}ms)`);
    console.log(`   └─ ${node.details}`);
  });

  console.log('\n--- LOGS DE EXECUÇÃO ---');
  (report.logs || []).forEach((log) => console.log(' ' + log));

  console.log('\n============================================================');
  console.log(report.healthScore === 100 ? '  ✨ TESTE E2E APROVADO 100% COM SUCESSO!' : '  ⚠️ TESTE CONCLUÍDO COM ATENÇÃO');
  console.log('============================================================\n');

  process.exit(report.healthScore >= 80 ? 0 : 1);
}

runLocalSuite();
