const fs = require('fs');
const path = require('path');

const historyDir = path.join(__dirname, '..', 'tests', 'history');
const actionPlanFile = path.join(process.cwd(), 'ACTION_PLAN.md');

function analyzeTests() {
  console.log("🧠 [AI Bug Analyzer] Lendo base histórica...");

  if (!fs.existsSync(historyDir)) {
    console.error("Nenhum histórico encontrado. Rode `npm run test:flash` primeiro.");
    return;
  }

  const files = fs.readdirSync(historyDir).filter(f => f.endsWith('.json'));
  const allReports = [];
  const newBugs = []; // NEW ARRAY FOR TODO-BUGS QUEUE

  // Leitura e Limpeza (manter apenas relatórios mais recentes para não lotar o disco)
  // Agrupamos por Rota e pegamos apenas as duas últimas execuções para comparar regressão
  
  const routeMap = new Map();
  let floodReports = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(historyDir, file), 'utf8');
    const data = JSON.parse(content);
    
    if (data.type === 'API_FLOOD') {
      floodReports.push({ file, ...data });
    } else {
      if (!routeMap.has(data.route)) routeMap.set(data.route, []);
      routeMap.get(data.route).push({ file, ...data });
    }
  }

  // Ordenar e extrair Action Plan
  let markdown = `# 🚨 Relatório de Bugs e Plano de Ação para Desenvolvedores (Auto-Gerado)\n\n`;
  markdown += `*Gerado em: ${new Date().toISOString()}*\n\n`;
  markdown += `--- \n\n`;

  let actionItemsCount = 0;

  // Analisar Front-end Chaos
  markdown += `## 🖥️ Front-End (Análise Visual & Caos)\n\n`;

  for (const [route, reports] of routeMap.entries()) {
    // Sort by newest
    reports.sort((a, b) => b.file.localeCompare(a.file));
    
    const latest = reports[0];
    const previous = reports[1];

    if (latest.errors && latest.errors.length > 0) {
      markdown += `### 🔴 Rota: \`${route}\`\n`;
      markdown += `Foram encontrados os seguintes erros de JavaScript ou Console:\n`;
      for (const err of latest.errors) {
        markdown += `- \`${err}\`\n`;
        newBugs.push(`Erro JS/Console na rota ${route}: ${err}`);
      }
      markdown += `\n**➡️ Ação Sugerida:** Verificar se há variáveis nulas ou chamadas de API quebradas nesta tela.\n\n`;
      actionItemsCount++;
    }

    // Regressão de Performance UI
    if (previous) {
      const diff = latest.durationMs - previous.durationMs;
      if (diff > 500) { // Ficou 500ms mais lento
        markdown += `### 🐢 Regressão de Performance: \`${route}\`\n`;
        markdown += `- A página está carregando **${diff}ms mais lenta** comparada ao último teste.\n`;
        markdown += `**➡️ Ação Sugerida:** Inspecione o tab Network ou React Profiler para identificar novos componentes lentos.\n\n`;
        actionItemsCount++;
        newBugs.push(`Regressão de Interface: Rota ${route} ficou ${diff}ms mais lenta ao renderizar.`);
      }
    }
  }

  // Analisar Back-end Flood
  markdown += `## ⚙️ Back-End (API Flood & Stress)\n\n`;
  floodReports.sort((a, b) => b.file.localeCompare(a.file));
  const latestFlood = floodReports[0];
  const previousFlood = floodReports[1];

  if (latestFlood) {
    if (latestFlood.errors > 0) {
      markdown += `### 💥 Falha de Estresse de Rede\n`;
      markdown += `- Durante o teste de ${latestFlood.requestsMade} requisições, **${latestFlood.errors} falharam**.\n`;
      markdown += `**➡️ Ação Sugerida:** Aumentar conexões do Pool do Banco de Dados ou escalar workers do Node.\n\n`;
      actionItemsCount++;
      newBugs.push(`Falha no Back-end Sob Carga: ${latestFlood.errors} requisições falharam num teste de stress.`);
    }

    if (previousFlood) {
      const latDiff = latestFlood.averageLatencyMs - previousFlood.averageLatencyMs;
      if (latDiff > 50) { // Latência aumentou em 50ms na média sob carga
        markdown += `### 🐢 Regressão de Latência API\n`;
        markdown += `- A API está demorando em média **${latDiff.toFixed(2)}ms a mais** para responder sob carga em comparação ao último teste.\n`;
        markdown += `**➡️ Ação Sugerida:** Verifique se as consultas SQL recentes adicionaram N+1 queries ou se faltam índices.\n\n`;
        actionItemsCount++;
        newBugs.push(`Regressão de Latência: API Flood ficou ${latDiff.toFixed(2)}ms mais lento.`);
      }
    }
  }

  if (actionItemsCount === 0) {
    markdown += `### ✅ Tudo Limpo!\nNenhum erro de UI, quebra de Chaos Monkey ou lentidão de Back-End encontrados nesta iteração.\n`;
  }

  fs.writeFileSync(actionPlanFile, markdown);
  console.log(`\n📄 [Análise Completa] Plano de Ação gerado em: ${actionPlanFile}`);
  
  // ----------------------------------------------------
  // INTEGRAÇÃO COM TODO-BUGS.md (Fila de Backlog QA)
  // ----------------------------------------------------
  if (newBugs.length > 0) {
    const todoFile = path.join(process.cwd(), 'TODO-BUGS.md');
    let todoContent = fs.existsSync(todoFile) ? fs.readFileSync(todoFile, 'utf8') : '# 🐛 Fila Contínua de Bugs\n\n## 📋 Backlog Atual\n\n';
    
    let injectedCount = 0;
    for (const bug of newBugs) {
      // Evita duplicar a mesma tarefa exata na fila
      if (!todoContent.includes(bug)) {
        todoContent += `- [ ] **BUG DETECTADO (${new Date().toISOString().split('T')[0]}):** ${bug}\n`;
        injectedCount++;
      }
    }

    if (injectedCount > 0) {
      fs.writeFileSync(todoFile, todoContent);
      console.log(`📌 Enfileirados ${injectedCount} novos bugs no arquivo TODO-BUGS.md para resolução futura!`);
    }
  }

  // Limpeza de histórico antigo
  if (files.length > 50) {
    console.log("Limpando histórico antigo...");
    files.sort();
    const toDelete = files.slice(0, files.length - 20); // Mantem os ultimos 20
    for (const d of toDelete) {
      fs.unlinkSync(path.join(historyDir, d));
    }
  }
}

analyzeTests();
