const featureEngine = require('../featureEngine');

function parseModulePrompt(prompt = '') {
  const text = String(prompt || '').trim();
  const match = text.match(/create\s+(.+?)\s+module/i);
  const moduleName = match ? String(match[1]).trim() : text;

  return {
    moduleName,
    valid: Boolean(moduleName),
  };
}

async function createModule(moduleName) {
  const normalized = String(moduleName || '').trim();
  if (!normalized) {
    throw new Error('moduleName is required.');
  }

  const generated = await featureEngine.createModule(normalized);
  return {
    generatedAt: new Date().toISOString(),
    module: generated.module,
    apiBasePath: generated.apiBasePath,
    routePath: generated.routePath,
    files: generated.files,
    created: generated.created,
  };
}

module.exports = {
  createModule,
  parseModulePrompt,
};
