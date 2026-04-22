const { analyzeProject } = require('./projectAnalyzer');

function buildWarnings(analysis) {
  const warnings = [];

  for (const route of analysis.apiRoutes || []) {
    if (route.path.includes(':')) {
      warnings.push(`Dynamic route detected: ${route.method} ${route.path}`);
    }
  }

  if ((analysis.components || []).length === 0) {
    warnings.push('No frontend components found in frontend/src/components.');
  }

  return warnings;
}

function buildErrors(analysis) {
  const errors = [];

  for (const page of analysis.missingPages || []) {
    errors.push(`Missing page for route ${page.routePath}: ${page.componentName}`);
  }

  for (const importer of analysis.missingComponents || []) {
    errors.push(`Missing component import ${importer.importSource} in ${importer.importer}`);
  }

  for (const api of analysis.missingApis || []) {
    errors.push(`Frontend calls missing API endpoint: ${api}`);
  }

  return errors;
}

function buildSuggestions(analysis) {
  const suggestions = [];

  if ((analysis.missingPages || []).length > 0) {
    suggestions.push('Run page replicator to auto-create missing pages from a template.');
  }

  if ((analysis.missingApis || []).length > 0) {
    suggestions.push('Create controller/route handlers for missing frontend API calls.');
  }

  if ((analysis.missingComponents || []).length > 0) {
    suggestions.push('Fix broken component imports or create the missing component files.');
  }

  if (suggestions.length === 0) {
    suggestions.push('No major structural issues detected. Keep pipeline tasks synced with new features.');
  }

  return suggestions;
}

async function curateCodebase(options = {}) {
  const analysis = await analyzeProject({
    autoCreateMissingPages: options.autoCreateMissingPages === true,
  });

  return {
    errors: buildErrors(analysis),
    warnings: buildWarnings(analysis),
    suggestions: buildSuggestions(analysis),
  };
}

module.exports = {
  curateCodebase,
};
