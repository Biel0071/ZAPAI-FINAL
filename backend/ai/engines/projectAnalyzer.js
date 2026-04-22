const path = require('path');
const baseProjectAnalyzer = require('../projectAnalyzer');
const { buildSystemArchitectureMap } = require('../../core/architectureMap');

function toProjectMap(analysis, architecture) {
  return {
    modules: (architecture.modules || []).map((item) => item.name),
    pages: (analysis.pages || []).map((item) => item.file),
    components: (analysis.components || []).map((item) => item.file),
    apis: (analysis.apiRoutes || []).map((item) => `${item.method} ${item.path}`),
    routes: (analysis.apiRoutes || []).map((item) => item.path),
  };
}

async function analyze(options = {}) {
  const analysis = await baseProjectAnalyzer.analyzeProject({
    autoCreateMissingPages: false,
    ...options,
  });
  const architecture = await buildSystemArchitectureMap();

  return {
    generatedAt: new Date().toISOString(),
    projectRoot: path.resolve(__dirname, '..', '..', '..'),
    projectMap: toProjectMap(analysis, architecture),
    diagnostics: {
      brokenImports: analysis.missingComponents || [],
      missingApis: analysis.missingApis || [],
      missingPages: analysis.missingPages || [],
      routes: analysis.apiRoutes || [],
      uiComponents: analysis.components || [],
      unusedFiles: analysis.unusedFiles || [],
    },
    raw: analysis,
  };
}

module.exports = {
  analyze,
};
