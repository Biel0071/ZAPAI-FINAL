const fs = require('fs/promises');
const path = require('path');

const { analyzeProject } = require('../ai/projectAnalyzer');
const { runArchitectFullScan } = require('../ai/saasArchitectEngine');
const { analyzeRuntime } = require('../ai/systemHealthAnalyzer');

const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.css', '.md']);
const SKIP_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'uploads',
  'upload',
  'media',
  'logs',
  'data',
  'dist',
  'build',
  '.vite',
]);

function toRelative(projectRoot, absolutePath) {
  return String(path.relative(projectRoot, absolutePath) || '')
    .replace(/\\/g, '/')
    .trim();
}

async function walkSourceFiles(rootDir) {
  const files = [];

  async function walk(currentDir) {
    let entries = [];

    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (SKIP_DIRECTORIES.has(entry.name)) {
          continue;
        }

        await walk(fullPath);
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();
      if (SOURCE_EXTENSIONS.has(extension)) {
        files.push(fullPath);
      }
    }
  }

  await walk(rootDir);
  return files;
}

async function readText(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

function countPattern(content = '', pattern) {
  return (content.match(pattern) || []).length;
}

async function collectLargeFiles(projectRoot, files = []) {
  const measurements = await Promise.all(
    files.map(async (filePath) => {
      const content = await readText(filePath);
      return {
        file: toRelative(projectRoot, filePath),
        lines: content ? content.split(/\r?\n/).length : 0,
      };
    })
  );

  return measurements
    .filter((entry) => entry.lines >= 250)
    .sort((left, right) => right.lines - left.lines)
    .slice(0, 12);
}

async function collectHotspots(projectRoot, files = []) {
  const hotspots = [];

  for (const filePath of files) {
    const content = await readText(filePath);
    const relativeFile = toRelative(projectRoot, filePath);

    const setIntervalCount = countPattern(content, /setInterval\s*\(/g);
    const useEffectCount = countPattern(content, /useEffect\s*\(/g);
    const legacyFlag = /\.legacy\./i.test(path.basename(filePath));

    if (setIntervalCount > 0) {
      hotspots.push({
        area: relativeFile.startsWith('frontend/') ? 'frontend' : 'backend',
        file: relativeFile,
        issue: 'interval_usage',
        message: `${setIntervalCount} timer(s) encontrado(s). Revisar polling e limpeza.`,
        weight: setIntervalCount,
      });
    }

    if (relativeFile.startsWith('frontend/') && useEffectCount >= 3) {
      hotspots.push({
        area: 'frontend',
        file: relativeFile,
        issue: 'dense_effects',
        message: `${useEffectCount} useEffect encontrados. Avaliar consolidacao de estado e efeitos.`,
        weight: useEffectCount,
      });
    }

    if (legacyFlag) {
      hotspots.push({
        area: relativeFile.startsWith('frontend/') ? 'frontend' : 'backend',
        file: relativeFile,
        issue: 'legacy_module',
        message: 'Arquivo marcado como legacy ainda presente na base ativa.',
        weight: 1,
      });
    }
  }

  return hotspots.sort((left, right) => right.weight - left.weight).slice(0, 14);
}

function toProblem(id, severity, category, title, detail, evidence = []) {
  return {
    id,
    severity,
    category,
    title,
    detail,
    evidence,
  };
}

function toImprovement(id, area, priority, title, summary, recommendation, evidence = []) {
  return {
    id,
    area,
    priority,
    title,
    summary,
    recommendation,
    evidence,
    source: 'engineering',
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
}

function buildNextSteps(problems = [], improvements = []) {
  const nextSteps = [];

  for (const problem of problems.slice(0, 6)) {
    nextSteps.push({
      title: problem.title,
      action: problem.detail,
      priority: problem.severity,
    });
  }

  for (const improvement of improvements.slice(0, 4)) {
    nextSteps.push({
      title: improvement.title,
      action: improvement.recommendation,
      priority: improvement.priority,
    });
  }

  return nextSteps.slice(0, 8);
}

async function analyzeEngineering(options = {}) {
  const backendRoot = path.resolve(__dirname, '..');
  const projectRoot = path.resolve(backendRoot, '..', '..');
  const frontendRoot = path.join(projectRoot, 'frontend');
  const frontendSourceRoot = path.join(frontendRoot, 'src');

  const [projectAnalysis, architectScan, runtimeHealth, backendFiles, frontendFiles] =
    await Promise.all([
      analyzeProject({ autoCreateMissingPages: false }),
      runArchitectFullScan({ autoCreateMissingPages: false }),
      analyzeRuntime({ app: options.app, autoRecover: false }),
      walkSourceFiles(backendRoot),
      walkSourceFiles(frontendSourceRoot),
    ]);

  const allFiles = [...backendFiles, ...frontendFiles];
  const [largeFiles, hotspots] = await Promise.all([
    collectLargeFiles(projectRoot, allFiles),
    collectHotspots(projectRoot, allFiles),
  ]);

  const problems = [];
  const improvements = [];

  if ((projectAnalysis.missingApis || []).length > 0) {
    problems.push(
      toProblem(
        'missing-apis',
        'high',
        'integration',
        'Endpoints consumidos sem rota correspondente',
        'A camada de frontend ainda referencia APIs sem match claro no backend.',
        projectAnalysis.missingApis.slice(0, 12)
      )
    );
  }

  if ((projectAnalysis.missingComponents || []).length > 0) {
    problems.push(
      toProblem(
        'missing-components',
        'high',
        'frontend',
        'Imports quebrados ou componentes ausentes',
        'Existem referencias a componentes que nao foram resolvidas pelo analisador do projeto.',
        projectAnalysis.missingComponents.slice(0, 12)
      )
    );
  }

  if ((architectScan.problems?.duplicatePages || []).length > 0) {
    problems.push(
      toProblem(
        'duplicate-pages',
        'medium',
        'architecture',
        'Paginas com nome duplicado',
        'A base possui paginas duplicadas por nome, aumentando risco de divergencia funcional.',
        architectScan.problems.duplicatePages.slice(0, 8)
      )
    );
  }

  if ((projectAnalysis.unusedFiles || []).length > 0) {
    problems.push(
      toProblem(
        'unused-files',
        'medium',
        'cleanup',
        'Arquivos potencialmente sem uso',
        'Arquivos nao referenciados elevam custo de manutencao e dificultam leitura da arquitetura.',
        projectAnalysis.unusedFiles.slice(0, 12)
      )
    );
  }

  if (largeFiles.length > 0) {
    problems.push(
      toProblem(
        'large-files',
        'medium',
        'maintainability',
        'Arquivos muito grandes concentram responsabilidades',
        'Partes centrais do sistema seguem com alta densidade e tendem a acumular regressao.',
        largeFiles.slice(0, 8)
      )
    );
  }

  if (hotspots.length > 0) {
    problems.push(
      toProblem(
        'performance-hotspots',
        'medium',
        'performance',
        'Hotspots de timer, efeito ou legado detectados',
        'Foram encontrados pontos com timers, uso intenso de efeitos ou modulos legacy no caminho ativo.',
        hotspots.slice(0, 10)
      )
    );
  }

  if ((runtimeHealth.warnings || []).length > 0) {
    problems.push(
      toProblem(
        'runtime-warnings',
        'medium',
        'runtime',
        'Avisos do runtime exigem monitoramento',
        'A saude operacional retornou alertas que merecem acompanhamento continuo.',
        runtimeHealth.warnings.slice(0, 10)
      )
    );
  }

  if (largeFiles.some((entry) => entry.file.endsWith('controllers/messagesController.js'))) {
    improvements.push(
      toImprovement(
        'split-messages-controller',
        'backend',
        'high',
        'Fatiar messagesController por responsabilidade',
        'Entrada, envio e sincronizacao em fallback ainda convivem no mesmo arquivo central.',
        'Extrair persistencia, envio outbound e sincronizacao realtime em modulos menores, preservando o contrato atual.',
        largeFiles.filter((entry) => entry.file.endsWith('controllers/messagesController.js'))
      )
    );
  }

  if (hotspots.some((entry) => entry.issue === 'dense_effects')) {
    improvements.push(
      toImprovement(
        'frontend-effect-consolidation',
        'frontend',
        'high',
        'Consolidar hooks com muitos efeitos',
        'Paginas com multiplos useEffect tendem a gerar flicker e sincronizacao mais fragil.',
        'Centralizar carregamento e reconciliacao em hooks dedicados, reduzindo re-renderes e dependencias cruzadas.',
        hotspots.filter((entry) => entry.issue === 'dense_effects').slice(0, 8)
      )
    );
  }

  if ((projectAnalysis.unusedFiles || []).length > 0) {
    improvements.push(
      toImprovement(
        'archive-unused-files',
        'cleanup',
        'medium',
        'Arquivar ou remover modulos nao utilizados',
        'Existe volume suficiente de arquivos potencialmente ociosos para justificar uma rodada de limpeza segura.',
        'Validar por smoke e mover modulos nao usados para uma area de legado documentada antes de remover.',
        projectAnalysis.unusedFiles.slice(0, 10)
      )
    );
  }

  if (hotspots.some((entry) => entry.issue === 'legacy_module')) {
    improvements.push(
      toImprovement(
        'legacy-boundary',
        'architecture',
        'medium',
        'Criar fronteira explicita para codigo legacy',
        'Arquivos legacy seguem misturados ao codigo ativo.',
        'Marcar ownership, definir plano de desativacao e impedir novas dependencias do codigo antigo.',
        hotspots.filter((entry) => entry.issue === 'legacy_module').slice(0, 10)
      )
    );
  }

  if ((runtimeHealth.warnings || []).length > 0) {
    improvements.push(
      toImprovement(
        'runtime-health-guardrails',
        'observability',
        'high',
        'Elevar guardrails de health e recovery',
        'Os warnings do runtime apontam necessidade de observabilidade mais previsivel.',
        'Promover um painel unico de health com indicadores de backend, frontend, WhatsApp, IA e fallbacks.',
        runtimeHealth.warnings.slice(0, 10)
      )
    );
  }

  const currentState = {
    generatedAt: new Date().toISOString(),
    frontend: {
      pages: (projectAnalysis.pages || []).length,
      components: (projectAnalysis.components || []).length,
      sourceRoot: toRelative(projectRoot, frontendSourceRoot),
    },
    backend: {
      routes: (projectAnalysis.apiRoutes || []).length,
      controllers: (projectAnalysis.controllers || []).length,
      services: (projectAnalysis.services || []).length,
      sourceRoot: toRelative(projectRoot, backendRoot),
    },
    runtime: {
      backendStatus: runtimeHealth.backendStatus,
      frontendStatus: runtimeHealth.frontendStatus,
      databaseStatus: runtimeHealth.databaseStatus,
      whatsappStatus: runtimeHealth.whatsappStatus,
      warnings: runtimeHealth.warnings || [],
    },
    architecture: {
      modules: architectScan.projectMap?.modules || [],
      apis: architectScan.projectMap?.apis || [],
    },
    hotspots: {
      largeFiles: largeFiles.slice(0, 6),
      timersAndEffects: hotspots.slice(0, 8),
    },
  };

  const learnedPatterns = [
    {
      type: 'runtime',
      title: 'Health operacional centralizado',
      detail: `Backend ${runtimeHealth.backendStatus}, frontend ${runtimeHealth.frontendStatus}, banco ${runtimeHealth.databaseStatus}.`,
    },
    {
      type: 'architecture',
      title: 'Cobertura modular',
      detail: `Modulos detectados: ${(architectScan.projectMap?.modules || []).join(', ') || 'nenhum modulo mapeado'}.`,
    },
    {
      type: 'maintainability',
      title: 'Arquivos concentradores',
      detail: largeFiles.length
        ? `${largeFiles[0].file} lidera em tamanho com ${largeFiles[0].lines} linhas.`
        : 'Nenhum arquivo acima do limiar configurado.',
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    currentState,
    problemsFound: problems,
    improvementsRecommended: improvements,
    nextSteps: buildNextSteps(problems, improvements),
    learnedPatterns,
    diagnostics: {
      projectAnalysis,
      architectScan,
      runtimeHealth,
      largeFiles,
      hotspots,
    },
  };
}

module.exports = {
  analyzeEngineering,
};
