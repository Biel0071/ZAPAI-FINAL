const fs = require('fs/promises');
const path = require('path');
const { analyzeProject } = require('./projectAnalyzer');
const { createModule } = require('./featureEngine');
const { MODULE_DEFINITIONS, buildSystemArchitectureMap } = require('../../core/common/architectureMap');

function toPascalCase(value) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function detectMissingModules() {
  const backendRoot = path.resolve(__dirname, '..');
  const projectRoot = path.resolve(backendRoot, '..', '..');
  const frontendPagesDir = path.join(projectRoot, 'frontend-official', 'src', 'pages');

  const missing = [];

  for (const moduleDef of MODULE_DEFINITIONS) {
    const pageChecks = await Promise.all(
      (moduleDef.frontendPages || []).map((page) => exists(path.join(frontendPagesDir, page)))
    );

    if (!pageChecks.some(Boolean)) {
      missing.push(moduleDef.key);
    }
  }

  return missing;
}

async function fixBrokenImports() {
  const backendRoot = path.resolve(__dirname, '..');
  const projectRoot = path.resolve(backendRoot, '..', '..');
  const frontendSrc = path.join(projectRoot, 'frontend-official', 'src');
  const analysis = await analyzeProject({ autoCreateMissingPages: false });

  const applied = [];

  for (const issue of analysis.missingComponents || []) {
    const importSource = String(issue.importSource || '');
    if (!importSource.startsWith('@/components/')) continue;

    const relative = importSource.replace(/^@\//, '');
    const absolute = path.join(frontendSrc, `${relative}.tsx`);

    if (await exists(absolute)) continue;

    const componentName = toPascalCase(path.basename(relative));
    const content = `export default function ${componentName || 'AutoComponent'}() {\n  return null;\n}\n`;

    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, content, 'utf8');
    applied.push(`Created ${relative}.tsx`);
  }

  return {
    fixedImports: applied,
  };
}

async function createApis(moduleName) {
  const result = await createModule(moduleName);
  return {
    module: result.module,
    apiBasePath: result.apiBasePath,
    backendFiles: {
      route: result.files.backendRoute,
      controller: result.files.backendController,
      service: result.files.backendService,
    },
  };
}

async function analyzeProjectCore() {
  const [analysis, map, missingModules] = await Promise.all([
    analyzeProject({ autoCreateMissingPages: false }),
    buildSystemArchitectureMap(),
    detectMissingModules(),
  ]);

  return {
    analysis,
    architectureMap: map,
    missingModules,
  };
}

async function runTask(task, payload = {}) {
  const normalizedTask = String(task || '').trim().toLowerCase();

  if (normalizedTask === 'analyze project') {
    return analyzeProjectCore();
  }

  if (normalizedTask === 'detect missing modules') {
    return { missingModules: await detectMissingModules() };
  }

  if (normalizedTask === 'generate modules') {
    const moduleName = String(payload.moduleName || payload.name || '').trim();
    if (!moduleName) throw new Error('moduleName is required to generate modules.');
    return createModule(moduleName);
  }

  if (normalizedTask === 'fix broken imports') {
    return fixBrokenImports();
  }

  if (normalizedTask === 'create apis') {
    const moduleName = String(payload.moduleName || payload.name || '').trim();
    if (!moduleName) throw new Error('moduleName is required to create APIs.');
    return createApis(moduleName);
  }

  return {
    supportedTasks: [
      'analyze project',
      'detect missing modules',
      'generate modules',
      'fix broken imports',
      'create apis',
    ],
  };
}

module.exports = {
  analyzeProjectCore,
  createApis,
  createModule,
  detectMissingModules,
  fixBrokenImports,
  runTask,
};
