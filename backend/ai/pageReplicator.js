const fs = require('fs/promises');
const path = require('path');

function toPascalCase(value) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

function toRoutePath(pageName) {
  return `/${String(pageName || '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()}`;
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveFrontendPaths() {
  const backendRoot = path.resolve(__dirname, '..');
  const projectRoot = path.resolve(backendRoot, '..', '..');
  const frontendRoot = path.join(projectRoot, 'frontend-official');
  const pagesDir = path.join(frontendRoot, 'src', 'pages');
  const appFile = path.join(frontendRoot, 'src', 'App.tsx');

  return {
    appFile,
    frontendRoot,
    pagesDir,
    projectRoot,
  };
}

function ensureLazyImport(appContent, newPageName) {
  const lazyDeclaration = `const ${newPageName} = lazy(() => import("./pages/${newPageName}"));`;
  if (appContent.includes(lazyDeclaration)) {
    return appContent;
  }

  const queryClientToken = 'const queryClient = new QueryClient();';
  if (appContent.includes(queryClientToken)) {
    return appContent.replace(queryClientToken, `${lazyDeclaration}\n${queryClientToken}`);
  }

  return `${appContent}\n${lazyDeclaration}\n`;
}

function ensureRoute(appContent, newPageName, routePath) {
  const routeLine = `                  <Route path="${routePath}" element={<${newPageName} />} />`;
  if (appContent.includes(routeLine)) {
    return appContent;
  }

  const settingsRouteToken = '                  <Route path="/settings" element={<Settings />} />';
  if (appContent.includes(settingsRouteToken)) {
    return appContent.replace(settingsRouteToken, `${routeLine}\n${settingsRouteToken}`);
  }

  const mainLayoutCloseToken = '                </Route>';
  if (appContent.includes(mainLayoutCloseToken)) {
    return appContent.replace(mainLayoutCloseToken, `${routeLine}\n${mainLayoutCloseToken}`);
  }

  return `${appContent}\n${routeLine}\n`;
}

async function replicatePage(templatePage, newPageName, options = {}) {
  const templateName = toPascalCase(templatePage);
  const targetName = toPascalCase(newPageName);

  if (!templateName || !targetName) {
    throw new Error('templatePage and newPageName are required.');
  }

  const { appFile, pagesDir } = await resolveFrontendPaths();
  const templateFile = path.join(pagesDir, `${templateName}.tsx`);
  const targetFile = path.join(pagesDir, `${targetName}.tsx`);

  if (!(await exists(templateFile))) {
    throw new Error(`Template page not found: ${templateFile}`);
  }

  const templateContent = await fs.readFile(templateFile, 'utf8');
  const targetRoutePath = options.routePath || toRoutePath(targetName);

  if (!(await exists(targetFile))) {
    const replicatedContent = templateContent.replace(new RegExp(`\\b${templateName}\\b`, 'g'), targetName);
    await fs.writeFile(targetFile, replicatedContent, 'utf8');
  }

  if (await exists(appFile)) {
    const appContent = await fs.readFile(appFile, 'utf8');
    const withImport = ensureLazyImport(appContent, targetName);
    const withRoute = ensureRoute(withImport, targetName, targetRoutePath);

    if (withRoute !== appContent) {
      await fs.writeFile(appFile, withRoute, 'utf8');
    }
  }

  return {
    pageFile: targetFile,
    routePath: targetRoutePath,
    templateFile,
  };
}

module.exports = {
  replicatePage,
  toRoutePath,
};
