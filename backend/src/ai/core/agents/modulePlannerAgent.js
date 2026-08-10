const projectAnalyzerEngine = require('../engines/projectAnalyzer');

async function run(payload = {}) {
  const analysis = await projectAnalyzerEngine.analyze(payload);

  const recommendations = [];

  if ((analysis.diagnostics.missingApis || []).length > 0) {
    recommendations.push({
      type: 'api_gap',
      items: analysis.diagnostics.missingApis,
      priority: 'high',
    });
  }

  if ((analysis.diagnostics.brokenImports || []).length > 0) {
    recommendations.push({
      type: 'broken_imports',
      items: analysis.diagnostics.brokenImports,
      priority: 'high',
    });
  }

  if ((analysis.diagnostics.unusedFiles || []).length > 0) {
    recommendations.push({
      type: 'cleanup_candidates',
      items: analysis.diagnostics.unusedFiles,
      priority: 'low',
    });
  }

  return {
    agent: 'modulePlannerAgent',
    generatedAt: new Date().toISOString(),
    recommendations,
    analysis,
  };
}

module.exports = {
  run,
};
