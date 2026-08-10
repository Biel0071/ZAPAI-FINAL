const path = require('path');
const { analyzeProject } = require('./projectAnalyzer');
const { analyzeUIScreens } = require('./uiAnalyzer');
const { generateFeatureRoadmap } = require('./featureRoadmapGenerator');
const { buildSystemArchitectureMap } = require('../../core/common/architectureMap');
const featureEngine = require('./featureEngine');
const pageLoopGenerator = require('./pageLoopGenerator');
const { runSmokeTests, runE2ETests } = require('../../../tests/testRunner');

const MODULE_LABELS = {
  AI: 'ai',
  Analytics: 'analytics',
  Automation: 'automation',
  Contacts: 'messaging',
  Inbox: 'messaging',
  System: 'system',
};

function uniqueList(items = []) {
  return [...new Set(items.filter(Boolean))];
}

function toProjectMap({ analysis, architecture }) {
  const modules = uniqueList(
    (architecture.modules || []).map((moduleItem) => MODULE_LABELS[moduleItem.name] || moduleItem.name.toLowerCase())
  );

  return {
    modules,
    pages: (analysis.pages || []).map((item) => item.file),
    components: (analysis.components || []).map((item) => item.file),
    apis: (analysis.apiRoutes || []).map((api) => `${api.method} ${api.path}`),
  };
}

function detectDuplicatePages(analysis) {
  const byName = new Map();
  const duplicates = [];

  for (const page of analysis.pages || []) {
    const key = String(page.name || '').toLowerCase();
    if (!key) continue;

    if (!byName.has(key)) {
      byName.set(key, [page.file]);
      continue;
    }

    const current = byName.get(key);
    current.push(page.file);
    byName.set(key, current);
  }

  for (const [name, files] of byName.entries()) {
    if (files.length > 1) {
      duplicates.push({ name, files });
    }
  }

  return duplicates;
}

function detectInconsistentNaming(analysis) {
  const namingIssues = [];

  const mixedCasePages = (analysis.pages || [])
    .filter((page) => /[-_]/.test(page.name || ''))
    .map((page) => page.file);

  if (mixedCasePages.length > 0) {
    namingIssues.push({
      type: 'page_naming',
      message: 'Some page files do not follow PascalCase naming.',
      files: mixedCasePages,
    });
  }

  const mixedCaseComponents = (analysis.components || [])
    .filter((component) => /[-_]/.test(component.name || ''))
    .map((component) => component.file);

  if (mixedCaseComponents.length > 0) {
    namingIssues.push({
      type: 'component_naming',
      message: 'Some component files do not follow PascalCase naming.',
      files: mixedCaseComponents,
    });
  }

  return namingIssues;
}

function buildProblemReport(analysis) {
  const duplicatePages = detectDuplicatePages(analysis);
  const brokenImports = (analysis.missingComponents || []).map((item) => ({
    importer: item.importer,
    importSource: item.importSource,
  }));

  const missingApis = analysis.missingApis || [];
  const missingUiComponents = (analysis.missingComponents || []).map((item) => item.importSource);
  const unusedModules = analysis.unusedFiles || [];
  const inconsistentNaming = detectInconsistentNaming(analysis);

  return {
    duplicatePages,
    brokenImports,
    missingApis,
    missingUiComponents,
    unusedModules,
    inconsistentNaming,
  };
}

function buildFeatureRoadmapPayload(generatedRoadmap, analysis, uiAnalysis) {
  const criticalIssues = [];

  if ((analysis.missingComponents || []).length > 0) {
    criticalIssues.push('Broken component imports detected in frontend modules.');
  }

  if ((analysis.missingApis || []).length > 0) {
    criticalIssues.push('Frontend endpoints without matching backend routes detected.');
  }

  if ((uiAnalysis.pages || []).some((page) => page.layout && page.layout.isResponsive === false)) {
    criticalIssues.push('Non-responsive UI layouts detected in analyzed pages.');
  }

  return {
    missingFeatures: generatedRoadmap.missingFeatures || [],
    improvements: generatedRoadmap.suggestedImprovements || [],
    criticalIssues: uniqueList(criticalIssues),
  };
}

async function runArchitectFullScan(options = {}) {
  const [analysis, architecture, uiAnalysis, generatedRoadmap] = await Promise.all([
    analyzeProject({ autoCreateMissingPages: options.autoCreateMissingPages === true }),
    buildSystemArchitectureMap(),
    analyzeUIScreens({ pageName: String(options.pageName || '').trim() }),
    generateFeatureRoadmap(),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    projectMap: toProjectMap({ analysis, architecture }),
    problems: buildProblemReport(analysis),
    featureRoadmap: buildFeatureRoadmapPayload(generatedRoadmap, analysis, uiAnalysis),
    diagnostics: {
      architectureModules: architecture.modules || [],
      analyzedPages: uiAnalysis.analyzedPages || 0,
      scannedFolders: analysis.scannedFolders || {},
    },
  };
}

async function generateCompleteModule({ moduleName, app, runTests = true } = {}) {
  const normalizedModuleName = String(moduleName || '').trim();
  if (!normalizedModuleName) {
    throw new Error('moduleName is required.');
  }

  const moduleResult = await featureEngine.createModule(normalizedModuleName);
  const scan = await runArchitectFullScan({ autoCreateMissingPages: false });

  let validation = null;
  if (runTests) {
    const smoke = await runSmokeTests();
    const e2e = await runE2ETests({ app });

    validation = {
      smoke,
      e2e,
      status: smoke.status === 'passed' && e2e.status === 'passed' ? 'passed' : 'failed',
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    module: moduleResult,
    validation,
    projectMap: scan.projectMap,
    problems: scan.problems,
    featureRoadmap: scan.featureRoadmap,
  };
}

async function generateCompletePages({ pageNames = [], templatePage = 'Inbox', app, runTests = false } = {}) {
  const validNames = Array.isArray(pageNames)
    ? pageNames.map((item) => String(item || '').trim()).filter(Boolean)
    : [];

  if (validNames.length === 0) {
    throw new Error('pageNames must be a non-empty array.');
  }

  const pagesResult = await pageLoopGenerator.generatePages(validNames, { templatePage });
  const scan = await runArchitectFullScan({ autoCreateMissingPages: false });

  let validation = null;
  if (runTests) {
    const smoke = await runSmokeTests();
    const e2e = await runE2ETests({ app });

    validation = {
      smoke,
      e2e,
      status: smoke.status === 'passed' && e2e.status === 'passed' ? 'passed' : 'failed',
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    pages: pagesResult,
    templatePage,
    validation,
    projectMap: scan.projectMap,
    problems: scan.problems,
    featureRoadmap: scan.featureRoadmap,
  };
}

module.exports = {
  generateCompleteModule,
  generateCompletePages,
  runArchitectFullScan,
};
