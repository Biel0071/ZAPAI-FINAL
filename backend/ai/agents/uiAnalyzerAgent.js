const uiEngine = require('../engines/uiEngine');

async function run(payload = {}) {
  const report = await uiEngine.analyzeUI(payload);

  return {
    agent: 'uiAnalyzerAgent',
    generatedAt: new Date().toISOString(),
    report,
  };
}

module.exports = {
  run,
};
