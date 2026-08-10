const fs = require('fs/promises');
const path = require('path');

const PAGE_EXTENSIONS = new Set(['.tsx', '.jsx']);

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readText(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

async function walkFiles(rootDir, extensions = PAGE_EXTENSIONS) {
  const results = [];

  if (!(await exists(rootDir))) {
    return results;
  }

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (extensions.has(ext)) {
        results.push(fullPath);
      }
    }
  }

  await walk(rootDir);
  return results;
}

function normalize(value) {
  return String(value || '').replace(/\\/g, '/');
}

function extractImportedComponents(source) {
  const imports = [];
  const importRegex = /import\s+([^;]+?)\s+from\s+['\"]([^'\"]+)['\"]/g;

  for (const match of source.matchAll(importRegex)) {
    const imported = String(match[1] || '');
    const from = String(match[2] || '');

    if (!from.startsWith('@/components/') && !from.includes('/components/')) continue;

    imported
      .replace(/[{}]/g, '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .forEach((entry) => imports.push(entry));
  }

  return imports;
}

function extractJsxTags(source) {
  const tags = new Set();
  const tagRegex = /<([A-Z][A-Za-z0-9_]*)\b/g;

  for (const match of source.matchAll(tagRegex)) {
    tags.add(match[1]);
  }

  return [...tags];
}

function detectDesignPatterns(source) {
  const patterns = [];

  if (/lazy\s*\(\s*\(\s*\)\s*=>\s*import\(/.test(source)) {
    patterns.push('lazy-loading');
  }

  if (/useState\(|useEffect\(|useMemo\(/.test(source)) {
    patterns.push('react-hooks-stateful');
  }

  if (/className\s*=\s*['\"][^'\"]*(grid|flex|space-|gap-)/.test(source)) {
    patterns.push('utility-first-layout');
  }

  if (/Card|Table|Tabs|Dialog|Drawer|Badge/.test(source)) {
    patterns.push('design-system-composition');
  }

  if (/socket|realtime|connect/i.test(source)) {
    patterns.push('realtime-interaction');
  }

  return [...new Set(patterns)];
}

function inferLayout(source) {
  const layout = {
    usesGrid: /className\s*=\s*['\"][^'\"]*grid/.test(source),
    usesFlex: /className\s*=\s*['\"][^'\"]*flex/.test(source),
    hasSidebar: /Sidebar|aside|Drawer/.test(source),
    hasHeader: /Header/.test(source),
    hasTable: /<table|Table/.test(source),
    hasCards: /Card/.test(source),
  };

  return layout;
}

async function analyzeUIScreens(options = {}) {
  const backendRoot = path.resolve(__dirname, '..');
  const projectRoot = path.resolve(backendRoot, '..', '..');
  const frontendRoot = path.join(projectRoot, 'frontend-official', 'src');
  const pagesDir = path.join(frontendRoot, 'pages');

  const pageFiles = await walkFiles(pagesDir);
  const targetPageName = String(options.pageName || '').trim();

  const selectedFiles = targetPageName
    ? pageFiles.filter((filePath) => path.basename(filePath, path.extname(filePath)).toLowerCase() === targetPageName.toLowerCase())
    : pageFiles;

  const pages = [];
  const globalPatterns = new Set();

  for (const filePath of selectedFiles) {
    const content = await readText(filePath);
    if (!content) continue;

    const importedComponents = extractImportedComponents(content);
    const hierarchy = extractJsxTags(content);
    const patterns = detectDesignPatterns(content);
    const layout = inferLayout(content);

    patterns.forEach((pattern) => globalPatterns.add(pattern));

    pages.push({
      page: path.basename(filePath),
      layout,
      componentHierarchy: hierarchy,
      importedComponents,
      designPatterns: patterns,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    analyzedPages: pages.length,
    pages,
    globalDesignPatterns: [...globalPatterns],
  };
}

module.exports = {
  analyzeUIScreens,
};
