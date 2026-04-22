const fs = require('fs/promises');
const path = require('path');
const { analyzeErrorEntry } = require('./errorAnalyzer');
const { analyzeProject } = require('./projectAnalyzer');
const { replicatePage } = require('./pageReplicator');
const { isDeniedText } = require('./safeCodeRules');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const FRONTEND_SRC = path.join(PROJECT_ROOT, 'frontend', 'src');
const GENERATED_ROUTES_FILE = path.join(__dirname, '..', 'routes', 'aiGeneratedFixes.js');

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function toPascalCase(value) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

async function ensureGeneratedRouteStub(endpoint) {
  const normalized = String(endpoint || '').trim();
  if (!normalized.startsWith('/')) return false;

  const content = await fs.readFile(GENERATED_ROUTES_FILE, 'utf8');
  if (content.includes(`'${normalized}'`)) {
    return false;
  }

  const stub = `router.all('${normalized}', (_req, res) => {\n  res.status(501).json({ error: 'ai_generated_stub', endpoint: '${normalized}' });\n});\n\nmodule.exports = router;`;
  if (isDeniedText(stub)) {
    return false;
  }
  const updated = content.replace('module.exports = router;', stub);
  await fs.writeFile(GENERATED_ROUTES_FILE, updated, 'utf8');
  return true;
}

async function createMissingComponentPlaceholders(missingComponents = []) {
  const applied = [];

  for (const item of missingComponents) {
    const importSource = String(item.importSource || '');
    if (!importSource.startsWith('@/components/')) continue;

    const relativePath = importSource.replace(/^@\//, '');
    const absoluteWithoutExt = path.join(FRONTEND_SRC, relativePath);

    const candidates = [
      `${absoluteWithoutExt}.tsx`,
      `${absoluteWithoutExt}.ts`,
      path.join(absoluteWithoutExt, 'index.tsx'),
      path.join(absoluteWithoutExt, 'index.ts'),
    ];

    let targetPath = candidates[0];
    if (absoluteWithoutExt.endsWith('/index') || absoluteWithoutExt.endsWith('\\index')) {
      targetPath = absoluteWithoutExt.endsWith('.tsx') ? absoluteWithoutExt : `${absoluteWithoutExt}.tsx`;
    }

    const existing = await Promise.all(candidates.map((candidate) => exists(candidate)));
    if (existing.some(Boolean)) continue;

    const componentName = toPascalCase(path.basename(relativePath));
    const placeholder = `export default function ${componentName || 'GeneratedComponent'}() {\n  return null;\n}\n`;

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, placeholder, 'utf8');
    applied.push(`Created placeholder component for ${importSource}`);
  }

  return applied;
}

async function applySafeFixes(errorEntry = {}, options = {}) {
  const fixesApplied = [];

  const analysis = analyzeErrorEntry(errorEntry);
  const structure = await analyzeProject({ autoCreateMissingPages: false });

  if (structure.missingPages.length > 0) {
    for (const page of structure.missingPages) {
      try {
        await replicatePage(options.templatePage || 'Inbox', page.componentName, { routePath: page.routePath });
        fixesApplied.push(`Created missing page ${page.componentName}`);
      } catch {
        // ignore individual page creation failure
      }
    }
  }

  const componentFixes = await createMissingComponentPlaceholders(structure.missingComponents || []);
  fixesApplied.push(...componentFixes);

  if ((analysis.probableCause || '').toLowerCase().includes('route mismatch') || (analysis.probableCause || '').toLowerCase().includes('api failure')) {
    for (const missingApi of structure.missingApis || []) {
      const changed = await ensureGeneratedRouteStub(missingApi);
      if (changed) {
        fixesApplied.push(`Created generated API stub for ${missingApi}`);
      }
    }
  }

  return {
    analysis,
    fixesApplied,
  };
}

async function selfHealError(errorEntry = {}, options = {}) {
  const { analysis, fixesApplied } = await applySafeFixes(errorEntry, options);
  let testReport = null;

  if (fixesApplied.length > 0 && options.skipTestRerun !== true) {
    try {
      const { runAllTests } = require('../tests/testRunner');
      testReport = await runAllTests({
        app: options.app,
        autoFix: false,
      });
    } catch (error) {
      testReport = {
        error: error.message || String(error),
      };
    }
  }

  return {
    analysis,
    fixesApplied,
    testReport,
  };
}

module.exports = {
  selfHealError,
};
