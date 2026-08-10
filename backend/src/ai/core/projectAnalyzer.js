const fs = require('fs/promises');
const path = require('path');

const CODE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);

function normalizeSlashes(value) {
  return String(value || '').replace(/\\/g, '/');
}

function normalizeEndpoint(endpoint) {
  const raw = String(endpoint || '').trim();
  if (!raw) return '';

  const withoutQuery = raw.split('?')[0].trim();
  if (!withoutQuery.startsWith('/')) return '';

  return withoutQuery.length > 1 ? withoutQuery.replace(/\/+$/, '') : withoutQuery;
}

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

async function walkFiles(rootDir, extensions = CODE_EXTENSIONS) {
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

function toProjectRelative(projectRoot, absolutePath) {
  return normalizeSlashes(path.relative(projectRoot, absolutePath));
}

function routePathToRegex(routePath) {
  const escaped = routePath
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\:([A-Za-z0-9_]+)/g, '[^/]+');

  return new RegExp(`^${escaped}/?$`, 'i');
}

function parseAppRoutes(appContent) {
  const lazyImports = new Map();
  const missingPageCandidates = [];

  const lazyRegex = /const\s+([A-Za-z0-9_]+)\s*=\s*lazy\s*\(\s*\(\s*\)\s*=>\s*import\(\s*['\"]([^'\"]+)['\"]\s*\)\s*\)\s*;?/g;
  for (const match of appContent.matchAll(lazyRegex)) {
    lazyImports.set(match[1], match[2]);
  }

  const routeRegex = /<Route\s+path=["']([^"']+)["']\s+element=\{<([A-Za-z0-9_]+)\s*\/>\}\s*\/?\s*>?/g;
  for (const match of appContent.matchAll(routeRegex)) {
    missingPageCandidates.push({
      componentName: match[2],
      importPath: lazyImports.get(match[2]) || null,
      routePath: match[1],
    });
  }

  return missingPageCandidates;
}

async function resolveImportToFile(importerPath, importSource, frontendSrcRoot) {
  let basePath = '';

  if (importSource.startsWith('@/')) {
    basePath = path.join(frontendSrcRoot, importSource.replace(/^@\//, ''));
  } else if (importSource.startsWith('.')) {
    basePath = path.resolve(path.dirname(importerPath), importSource);
  } else {
    return null;
  }

  const candidates = [
    basePath,
    `${basePath}.tsx`,
    `${basePath}.ts`,
    `${basePath}.jsx`,
    `${basePath}.js`,
    path.join(basePath, 'index.tsx'),
    path.join(basePath, 'index.ts'),
    path.join(basePath, 'index.jsx'),
    path.join(basePath, 'index.js'),
  ];

  for (const candidate of candidates) {
    if (await exists(candidate)) {
      return candidate;
    }
  }

  return null;
}

function parseFileImports(fileContent) {
  const imports = [];
  const importRegex = /import\s+[^;]+?\s+from\s+['\"]([^'\"]+)['\"]/g;

  for (const match of fileContent.matchAll(importRegex)) {
    const value = String(match[1] || '').trim();
    if (value) imports.push(value);
  }

  return imports;
}

function parseFrontendEndpoints(fileContent) {
  const endpoints = new Set();

  const endpointPropertyRegex = /endpoint\s*:\s*['\"](\/[^'\"]+)['\"]/g;
  for (const match of fileContent.matchAll(endpointPropertyRegex)) {
    const normalized = normalizeEndpoint(match[1]);
    if (normalized) endpoints.add(normalized);
  }

  const fetchRegex = /fetch\s*\(\s*['\"](\/[^'\"]+)['\"]/g;
  for (const match of fileContent.matchAll(fetchRegex)) {
    const normalized = normalizeEndpoint(match[1]);
    if (normalized) endpoints.add(normalized);
  }

  const apiRequestRegex = /apiRequest(?:<[^>]+>)?\s*\(\s*['\"](\/[^'\"]+)['\"]/g;
  for (const match of fileContent.matchAll(apiRequestRegex)) {
    const normalized = normalizeEndpoint(match[1]);
    if (normalized) endpoints.add(normalized);
  }

  return endpoints;
}

function parseBackendRoutes(routeContent) {
  const routes = [];
  const routeRegex = /router\.(get|post|put|patch|delete)\s*\(\s*['\"]([^'\"]+)['\"]/gi;

  for (const match of routeContent.matchAll(routeRegex)) {
    const method = String(match[1] || '').toUpperCase();
    const routePath = normalizeEndpoint(match[2]);

    if (!routePath) continue;

    routes.push({
      method,
      path: routePath,
      matcher: routePathToRegex(routePath),
    });
  }

  return routes;
}

function withRoutePrefix(routePath, prefix = '') {
  const normalizedPrefix = normalizeEndpoint(prefix) || '';
  const normalizedRoute = normalizeEndpoint(routePath) || '';

  if (!normalizedPrefix) {
    return normalizedRoute;
  }

  if (!normalizedRoute) {
    return normalizedPrefix;
  }

  if (normalizedRoute === '/') {
    return normalizedPrefix;
  }

  return normalizeEndpoint(`${normalizedPrefix}${normalizedRoute}`) || normalizedRoute;
}

function getRoutePrefixesForFile(routeFilePath) {
  const fileName = path.basename(routeFilePath).toLowerCase();

  if (fileName === 'messages.js' || fileName === 'conversations.js') {
    return ['', '/api'];
  }

  if (fileName === 'system.js') {
    return ['/system'];
  }

  return [''];
}

function matchEndpoint(endpoint, routeDefinitions) {
  return routeDefinitions.some((route) => route.matcher.test(endpoint));
}

async function analyzeProject(options = {}) {
  const backendRoot = path.resolve(__dirname, '..');
  const projectRoot = path.resolve(backendRoot, '..', '..');
  const frontendRoot = path.join(projectRoot, 'frontend-official');
  const frontendSrcRoot = path.join(frontendRoot, 'src');

  const pagesDir = path.join(frontendSrcRoot, 'pages');
  const componentsDir = path.join(frontendSrcRoot, 'components');
  const routesDir = path.join(backendRoot, 'routes');
  const controllersDir = path.join(backendRoot, 'controllers');
  const servicesDir = path.join(backendRoot, 'services');

  const pageFiles = await walkFiles(pagesDir);
  const componentFiles = await walkFiles(componentsDir);
  const routeFiles = await walkFiles(routesDir);
  const controllerFiles = await walkFiles(controllersDir);
  const serviceFiles = await walkFiles(servicesDir);
  const frontendSourceFiles = await walkFiles(frontendSrcRoot);

  const pages = pageFiles.map((file) => ({
    file: toProjectRelative(projectRoot, file),
    absolutePath: normalizeSlashes(file),
    name: path.basename(file, path.extname(file)),
  }));

  const components = componentFiles.map((file) => ({
    file: toProjectRelative(projectRoot, file),
    absolutePath: normalizeSlashes(file),
    name: path.basename(file, path.extname(file)),
  }));

  const appPath = path.join(frontendSrcRoot, 'App.tsx');
  const appContent = await readText(appPath);
  const routeReferences = parseAppRoutes(appContent);
  const existingPageNames = new Set(pages.map((entry) => entry.name));

  const missingPages = routeReferences
    .filter((ref) => ref.componentName !== 'NotFound')
    .filter((ref) => !existingPageNames.has(ref.componentName))
    .map((ref) => ({
      componentName: ref.componentName,
      importPath: ref.importPath,
      routePath: ref.routePath,
    }));

  const missingComponents = [];
  const referencedFrontendFiles = new Set([normalizeSlashes(appPath)]);

  for (const sourceFile of frontendSourceFiles) {
    const content = await readText(sourceFile);
    const sourceFileImports = parseFileImports(content);

    for (const importSource of sourceFileImports) {
      const targetsComponents = importSource.startsWith('@/components/') || /(^\.\.?\/).*components\//.test(importSource);
      const resolved = await resolveImportToFile(sourceFile, importSource, frontendSrcRoot);

      if (resolved) {
        referencedFrontendFiles.add(normalizeSlashes(resolved));
      }

      if (!targetsComponents) continue;

      if (!resolved) {
        missingComponents.push({
          importer: toProjectRelative(projectRoot, sourceFile),
          importSource,
        });
      }
    }
  }

  const backendRoutes = [];
  for (const routeFile of routeFiles) {
    const content = await readText(routeFile);
    const parsed = parseBackendRoutes(content);
    const prefixes = getRoutePrefixesForFile(routeFile);
    const expanded = [];

    for (const route of parsed) {
      for (const prefix of prefixes) {
        const prefixedPath = withRoutePrefix(route.path, prefix);
        if (!prefixedPath) continue;

        expanded.push({
          ...route,
          path: prefixedPath,
          matcher: routePathToRegex(prefixedPath),
          file: toProjectRelative(projectRoot, routeFile),
        });
      }
    }

    backendRoutes.push(...expanded);
  }

  const frontendEndpoints = new Set();
  for (const sourceFile of frontendSourceFiles) {
    const content = await readText(sourceFile);
    const endpoints = parseFrontendEndpoints(content);
    endpoints.forEach((value) => frontendEndpoints.add(value));
  }

  const missingApis = Array.from(frontendEndpoints)
    .filter((endpoint) => !matchEndpoint(endpoint, backendRoutes))
    .sort();

  const frontendEntryFiles = new Set(
    [
      path.join(frontendSrcRoot, 'main.tsx'),
      path.join(frontendSrcRoot, 'App.tsx'),
      path.join(frontendSrcRoot, 'pages', 'Index.tsx'),
    ]
      .map((entry) => normalizeSlashes(entry))
      .filter((entry) => frontendSourceFiles.some((filePath) => normalizeSlashes(filePath) === entry))
  );

  frontendEntryFiles.forEach((entry) => referencedFrontendFiles.add(entry));

  const codeFilesForUsage = [...pageFiles, ...componentFiles]
    .map((entry) => normalizeSlashes(entry));

  const unusedFiles = codeFilesForUsage
    .filter((filePath) => !referencedFrontendFiles.has(filePath))
    .map((filePath) => toProjectRelative(projectRoot, filePath))
    .sort();

  const structureMap = {
    pages,
    components,
    apiRoutes: backendRoutes.map((route) => ({
      method: route.method,
      path: route.path,
      file: route.file,
    })),
    missingPages,
    missingApis,
    missingComponents,
    unusedFiles,
    scannedFolders: {
      pages: toProjectRelative(projectRoot, pagesDir),
      components: toProjectRelative(projectRoot, componentsDir),
      frontendSrc: toProjectRelative(projectRoot, frontendSrcRoot),
      routes: toProjectRelative(projectRoot, routesDir),
      controllers: toProjectRelative(projectRoot, controllersDir),
      services: toProjectRelative(projectRoot, servicesDir),
    },
    backendFiles: {
      controllers: controllerFiles.map((file) => toProjectRelative(projectRoot, file)),
      services: serviceFiles.map((file) => toProjectRelative(projectRoot, file)),
    },
  };

  if (options.autoCreateMissingPages !== false && structureMap.missingPages.length > 0) {
    try {
      const { replicatePage } = require('./pageReplicator');
      const templatePage = options.templatePage || 'Inbox';
      const autoCreated = [];

      for (const missingPage of structureMap.missingPages) {
        try {
          const result = await replicatePage(templatePage, missingPage.componentName, {
            routePath: missingPage.routePath,
          });
          autoCreated.push({
            page: missingPage.componentName,
            routePath: missingPage.routePath,
            file: toProjectRelative(projectRoot, result.pageFile),
          });
        } catch {
          // ignore single-page generation failures
        }
      }

      structureMap.autoCreatedPages = autoCreated;
    } catch {
      structureMap.autoCreatedPages = [];
    }
  }

  return structureMap;
}

module.exports = {
  analyzeProject,
  normalizeEndpoint,
};
