const projectAnalyzerEngine = require('../engines/projectAnalyzer');

async function run(payload = {}) {
  const analysis = await projectAnalyzerEngine.analyze(payload);

  return {
    agent: 'architectAgent',
    generatedAt: new Date().toISOString(),
    summary: {
      modules: analysis.projectMap.modules,
      missingApis: analysis.diagnostics.missingApis,
      brokenImports: analysis.diagnostics.brokenImports,
    },
    analysis,
  };
}

module.exports = {
  run,
};
