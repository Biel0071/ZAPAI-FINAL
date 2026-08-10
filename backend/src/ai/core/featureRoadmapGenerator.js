const { analyzeProject } = require('./projectAnalyzer');
const { analyzeUIScreens } = require('./uiAnalyzer');

function buildMissingFeatures(analysis, uiAnalysis) {
  const missing = [];

  for (const page of analysis.missingPages || []) {
    missing.push(`Missing page: ${page.componentName} (${page.routePath})`);
  }

  for (const api of analysis.missingApis || []) {
    missing.push(`Missing API endpoint: ${api}`);
  }

  if ((uiAnalysis.globalDesignPatterns || []).length === 0) {
    missing.push('No reusable design pattern detected across screens.');
  }

  const pagesWithoutCards = (uiAnalysis.pages || [])
    .filter((page) => !page.layout?.hasCards)
    .map((page) => page.page);

  if (pagesWithoutCards.length > 0) {
    missing.push(`Inconsistent visual structure on pages: ${pagesWithoutCards.join(', ')}`);
  }

  return missing;
}

function buildSuggestedImprovements(analysis, uiAnalysis) {
  const suggestions = [];

  if ((analysis.unusedFiles || []).length > 0) {
    suggestions.push('Review and archive unused files to reduce maintenance overhead.');
  }

  if ((analysis.missingComponents || []).length > 0) {
    suggestions.push('Create or restore missing component imports to prevent runtime breaks.');
  }

  if ((uiAnalysis.globalDesignPatterns || []).includes('realtime-interaction')) {
    suggestions.push('Introduce resilient realtime fallback states and connection indicators on all chat-like pages.');
  }

  if (!(uiAnalysis.globalDesignPatterns || []).includes('design-system-composition')) {
    suggestions.push('Adopt design-system-first components for visual consistency.');
  }

  suggestions.push('Add module-level KPI cards to analytics and AI dashboard sections.');
  suggestions.push('Add task-level ownership and ETA metadata to AI-generated pipeline tasks.');

  return [...new Set(suggestions)];
}

function buildRoadmap(missingFeatures, improvements) {
  const phase1 = missingFeatures.slice(0, 5).map((item) => ({
    title: item,
    impact: 'high',
  }));

  const phase2 = improvements.slice(0, 5).map((item) => ({
    title: item,
    impact: 'medium',
  }));

  const phase3 = [
    {
      title: 'Stabilize auto-generation quality with post-generation lint/test gates.',
      impact: 'high',
    },
    {
      title: 'Create UX governance checks for consistency between Inbox, Contacts, and Analytics.',
      impact: 'medium',
    },
  ];

  return [
    { phase: 'Phase 1 - Structural Gaps', items: phase1 },
    { phase: 'Phase 2 - Product Improvements', items: phase2 },
    { phase: 'Phase 3 - Platform Evolution', items: phase3 },
  ];
}

async function generateFeatureRoadmap() {
  const [analysis, uiAnalysis] = await Promise.all([
    analyzeProject({ autoCreateMissingPages: false }),
    analyzeUIScreens(),
  ]);

  const missingFeatures = buildMissingFeatures(analysis, uiAnalysis);
  const suggestedImprovements = buildSuggestedImprovements(analysis, uiAnalysis);
  const productRoadmap = buildRoadmap(missingFeatures, suggestedImprovements);

  return {
    generatedAt: new Date().toISOString(),
    productRoadmap,
    missingFeatures,
    suggestedImprovements,
    inputs: {
      projectAnalysis: {
        missingPages: analysis.missingPages || [],
        missingApis: analysis.missingApis || [],
        missingComponents: analysis.missingComponents || [],
        unusedFiles: analysis.unusedFiles || [],
      },
      uiAnalysisSummary: {
        analyzedPages: uiAnalysis.analyzedPages,
        globalDesignPatterns: uiAnalysis.globalDesignPatterns,
      },
    },
  };
}

module.exports = {
  generateFeatureRoadmap,
};
