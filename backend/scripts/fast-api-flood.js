const http = require('http');

console.log("🌊 [Backend API Flood] Iniciando Teste de Stress Extremo...");

const PORT = 4025;
const HOST = '127.0.0.1';
const REQUESTS_TO_MAKE = 500;
const ENDPOINTS = [
  '/api/health',
  '/api/conversations',
  '/api/contacts'
];

// O keepAlive Agent previne que as portas locais do Node esgotem abrindo múltiplas conexões
const agent = new http.Agent({ keepAlive: true, maxSockets: 100 });

async function flood() {
  const startTime = Date.now();
  let success = 0;
  let errors = 0;
  
  const tasks = Array.from({ length: REQUESTS_TO_MAKE }).map((_, i) => {
    return new Promise((resolve) => {
      const path = ENDPOINTS[i % ENDPOINTS.length];
      
      const req = http.request({
        host: HOST,
        port: PORT,
        path: path,
        method: 'GET',
        agent: agent,
        // Usamos um tenant fixo e simulamos autenticação vazia/básica 
        // O foco é medir o tempo do middleware e parser rejeitando/aceitando sob carga
        headers: { 'x-tenant-id': 'default', 'Authorization': 'Bearer FLOOD_TEST' }
      }, (res) => {
        // Consumir os dados para liberar a memória e a conexão
        res.on('data', () => {});
        res.on('end', () => {
          // Status entre 200 e 401 são considerados sucesso de resposta (o servidor não travou)
          if (res.statusCode < 500) success++;
          else errors++;
          resolve();
        });
      });
      
      req.on('error', (e) => {
        errors++;
        resolve();
      });
      
      req.end();
    });
  });

  await Promise.all(tasks);
  
  const duration = Date.now() - startTime;
  console.log(`\n✅ Flood finalizado em ${duration}ms!`);
  console.log(`📊 Sucessos (Respostas OK/Auth Denied): ${success}`);
  console.log(`❌ Erros (Timeout/500/Crash): ${errors}`);
  
  // Salvar relatório para a ferramenta de Análise cruzar
  const fs = require('fs');
  const pathModule = require('path');
  const historyDir = pathModule.join(__dirname, '..', '..', 'frontend-official', 'tests', 'history');
  
  if (!fs.existsSync(historyDir)) {
    fs.mkdirSync(historyDir, { recursive: true });
  }

  const report = {
    type: "API_FLOOD",
    requestsMade: REQUESTS_TO_MAKE,
    durationMs: duration,
    success,
    errors,
    averageLatencyMs: duration / (REQUESTS_TO_MAKE / 100) // P99 aproximação baseada em concorrência de 100 maxSockets
  };

  fs.writeFileSync(
    pathModule.join(historyDir, `flood-report-${Date.now()}.json`),
    JSON.stringify(report, null, 2)
  );

  if (errors > REQUESTS_TO_MAKE * 0.05) { // Tolerância de 5% de erros
    console.error("🔥 Servidor cedeu sob estresse (> 5% de erros)!");
    process.exit(1);
  }
}

flood().catch(console.error);
