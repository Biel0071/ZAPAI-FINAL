const { analyzeUIScreens } = require('../uiAnalyzer');

async function analyzeUI(options = {}) {
  const pageName = String(options.pageName || '').trim();
  const report = await analyzeUIScreens({ pageName });

  return {
    generatedAt: new Date().toISOString(),
    analyzedPages: report.analyzedPages || 0,
    globalDesignPatterns: report.globalDesignPatterns || [],
    pages: report.pages || [],
  };
}

module.exports = {
  analyzeUI,
};
