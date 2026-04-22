const fs = require('fs/promises');
const path = require('path');

function toMarkdownList(items = [], formatter = (item) => String(item || '').trim()) {
  if (!Array.isArray(items) || items.length === 0) {
    return '- Nenhum item registrado.';
  }

  return items.map((item) => `- ${formatter(item)}`).join('\n');
}

async function ensureDocDirectories(projectRoot) {
  const directories = [
    path.join(projectRoot, 'docs', 'ai-analysis'),
    path.join(projectRoot, 'docs', 'system-map'),
    path.join(projectRoot, 'docs', 'improvements'),
    path.join(projectRoot, 'docs', 'learned-patterns'),
  ];

  await Promise.all(directories.map((directory) => fs.mkdir(directory, { recursive: true })));
  return directories;
}

async function generateAiDocumentation({
  projectRoot,
  engineeringReport,
  learningDashboard,
  state,
}) {
  await ensureDocDirectories(projectRoot);

  const currentStatePath = path.join(projectRoot, 'docs', 'ai-analysis', 'current-state.md');
  const systemMapPath = path.join(projectRoot, 'docs', 'system-map', 'architecture-map.md');
  const backlogPath = path.join(projectRoot, 'docs', 'improvements', 'backlog.md');
  const patternsPath = path.join(projectRoot, 'docs', 'learned-patterns', 'conversation-patterns.md');
  const machineReportPath = path.join(projectRoot, 'docs', 'ai-analysis', 'report.json');

  const currentStateContent = `# Estado Atual do Sistema

Gerado em: ${engineeringReport.generatedAt}

## Backend
- Rotas mapeadas: ${engineeringReport.currentState?.backend?.routes || 0}
- Controllers mapeados: ${engineeringReport.currentState?.backend?.controllers || 0}
- Services mapeados: ${engineeringReport.currentState?.backend?.services || 0}

## Frontend
- Paginas mapeadas: ${engineeringReport.currentState?.frontend?.pages || 0}
- Componentes mapeados: ${engineeringReport.currentState?.frontend?.components || 0}

## Runtime
- Backend: ${engineeringReport.currentState?.runtime?.backendStatus || 'unknown'}
- Frontend: ${engineeringReport.currentState?.runtime?.frontendStatus || 'unknown'}
- Banco: ${engineeringReport.currentState?.runtime?.databaseStatus || 'unknown'}
- WhatsApp: ${engineeringReport.currentState?.runtime?.whatsappStatus || 'unknown'}

## Problemas Encontrados
${toMarkdownList(engineeringReport.problemsFound, (problem) => `${problem.title}: ${problem.detail}`)}

## Proximos Passos
${toMarkdownList(engineeringReport.nextSteps, (step) => `${step.title} (${step.priority}) - ${step.action}`)}
`;

  const systemMapContent = `# Mapa de Arquitetura

Gerado em: ${engineeringReport.generatedAt}

## Modulos
${toMarkdownList(engineeringReport.currentState?.architecture?.modules || [])}

## APIs
${toMarkdownList(engineeringReport.currentState?.architecture?.apis || [])}

## Hotspots
${toMarkdownList(
    engineeringReport.currentState?.hotspots?.largeFiles || [],
    (entry) => `${entry.file} (${entry.lines} linhas)`
  )}
`;

  const backlogContent = `# Backlog de Melhorias

Gerado em: ${engineeringReport.generatedAt}

## Melhorias Recomendadas
${toMarkdownList(
    engineeringReport.improvementsRecommended,
    (item) => `[${item.priority}] ${item.title} - ${item.recommendation}`
  )}

## Sugestoes de Atendimento e IA
${toMarkdownList(
    learningDashboard?.suggestions || [],
    (item) => `${item.issueType}: ${item.problemDetected}`
  )}
`;

  const patternsContent = `# Padroes Aprendidos

Gerado em: ${engineeringReport.generatedAt}

## Perguntas Frequentes
${toMarkdownList(
    learningDashboard?.frequentCustomerQuestions || [],
    (entry) => `${entry.question} (${entry.count} ocorrencias)`
  )}

## Memoria de Conversa
${toMarkdownList(
    state.conversationMemory || [],
    (entry) => `${entry.contact_id}: ${entry.summary || 'Sem resumo'}`
  )}

## Insights
${toMarkdownList(state.insights || [], (entry) => `${entry.title}: ${entry.description}`)}
`;

  await Promise.all([
    fs.writeFile(currentStatePath, currentStateContent, 'utf8'),
    fs.writeFile(systemMapPath, systemMapContent, 'utf8'),
    fs.writeFile(backlogPath, backlogContent, 'utf8'),
    fs.writeFile(patternsPath, patternsContent, 'utf8'),
    fs.writeFile(
      machineReportPath,
      JSON.stringify(
        {
          generatedAt: engineeringReport.generatedAt,
          currentState: engineeringReport.currentState,
          problemsFound: engineeringReport.problemsFound,
          improvementsRecommended: engineeringReport.improvementsRecommended,
          nextSteps: engineeringReport.nextSteps,
          learnedPatterns: engineeringReport.learnedPatterns,
          memory: state.conversationMemory || [],
          insights: state.insights || [],
        },
        null,
        2
      ),
      'utf8'
    ),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    files: [
      {
        file: 'docs/ai-analysis/current-state.md',
        note: 'Resumo operacional consolidado',
      },
      {
        file: 'docs/system-map/architecture-map.md',
        note: 'Mapa dos modulos e APIs',
      },
      {
        file: 'docs/improvements/backlog.md',
        note: 'Backlog incremental de melhorias',
      },
      {
        file: 'docs/learned-patterns/conversation-patterns.md',
        note: 'Padroes detectados em memoria e atendimento',
      },
      {
        file: 'docs/ai-analysis/report.json',
        note: 'Snapshot estruturado para reuso interno',
      },
    ],
  };
}

module.exports = {
  generateAiDocumentation,
};
