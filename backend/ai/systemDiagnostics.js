const { analyzeRuntime } = require('./systemHealthAnalyzer');
const { analyzeProject } = require('./projectAnalyzer');
const { generateFeatureRoadmap } = require('./featureRoadmapGenerator');

function buildRecommendedActions(input = {}) {
  const actions = [];

  if ((input.systemHealth?.backendStatus || '') !== 'online') {
    actions.push('Restart backend runtime and validate /health response.');
  }

  if ((input.systemHealth?.frontendStatus || '') !== 'online') {
    actions.push('Restart frontend dev server and verify Vite port availability.');
  }

  const failedEndpoints = (input.systemHealth?.apiHealth || []).filter((entry) => entry.status !== 'ok');
  if (failedEndpoints.length > 0) {
    actions.push(`Fix failed API endpoints: ${failedEndpoints.map((entry) => entry.endpoint).join(', ')}.`);
  }

  const missingFeatures = input.roadmap?.missingFeatures || [];
  if (missingFeatures.length > 0) {
    actions.push(`Prioritize first missing features: ${missingFeatures.slice(0, 3).join(' | ')}.`);
  }

  const missingPages = input.architecture?.missingPages || [];
  if (missingPages.length > 0) {
    actions.push('Generate or implement missing frontend pages detected by analyzer.');
  }

  if (actions.length === 0) {
    actions.push('System appears healthy. Keep continuous monitoring enabled.');
  }

  return actions;
}

async function generateSystemDiagnosticReport(options = {}) {
  const [systemHealth, architecture, roadmap] = await Promise.all([
    analyzeRuntime({ app: options.app, autoRecover: options.autoRecover !== false }),
    analyzeProject({ autoCreateMissingPages: false }),
    generateFeatureRoadmap(),
  ]);

  const missingFeatures = Array.isArray(roadmap?.missingFeatures) ? roadmap.missingFeatures : [];
  const architectureWarnings = [];

  if ((architecture?.missingComponents || []).length > 0) {
    architectureWarnings.push('There are unresolved component imports.');
  }

  if ((architecture?.unusedFiles || []).length > 0) {
    architectureWarnings.push('There are unused files that should be reviewed.');
  }

  const warnings = [...(systemHealth.warnings || []), ...architectureWarnings];
  const recommendedActions = buildRecommendedActions({ systemHealth, architecture, roadmap });

  return {
    generatedAt: new Date().toISOString(),
    systemHealth,
    architecture,
    missingFeatures,
    warnings,
    recommendedActions,
  };
}

module.exports = {
  generateSystemDiagnosticReport,
};
