/**
 * ============================================================================
 * FRONTEND AUDIT SCRIPT
 * ============================================================================
 * 
 * Auditoria completa do frontend:
 * - Builds existentes
 * - Bundles ativos
 * - Arquivos órfãos
 * - Rotas antigas
 * - Service worker
 * - Caches possíveis
 * - Imports duplicados
 * - Páginas antigas compiladas
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const SRC_DIR = path.join(PROJECT_ROOT, 'src');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');

// Colors
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const NC = '\x1b[0m';

console.log(`${BLUE}========================================${NC}`);
console.log(`${BLUE}FRONTEND AUDIT${NC}`);
console.log(`${BLUE}========================================${NC}`);
console.log('');

const auditResults = {
  builds: 0,
  bundles: 0,
  orphanFiles: [],
  oldRoutes: [],
  serviceWorker: null,
  caches: [],
  duplicateImports: [],
  oldCompiledPages: [],
};

// 1. Mapear builds existentes
console.log(`${YELLOW}[1/8] Mapeando builds existentes...${NC}`);
if (fs.existsSync(DIST_DIR)) {
  const buildDirs = fs.readdirSync(DIST_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  auditResults.builds = buildDirs.length;
  console.log(`${GREEN}✓ Builds encontrados: ${buildDirs.length}${NC}`);
  
  if (buildDirs.length > 0) {
    buildDirs.forEach(dir => {
      console.log(`  - ${dir}`);
    });
  }
} else {
  console.log(`${YELLOW}⚠ Diretório dist não encontrado${NC}`);
}
console.log('');

// 2. Mapear bundles ativos
console.log(`${YELLOW}[2/8] Mapeando bundles ativos...${NC}`);
if (fs.existsSync(DIST_DIR)) {
  const jsFiles = getAllFiles(DIST_DIR, '.js');
  const cssFiles = getAllFiles(DIST_DIR, '.css');
  
  auditResults.bundles = jsFiles.length + cssFiles.length;
  console.log(`${GREEN}✓ JS bundles: ${jsFiles.length}${NC}`);
  console.log(`${GREEN}✓ CSS bundles: ${cssFiles.length}${NC}`);
  console.log(`${GREEN}✓ Total bundles: ${auditResults.bundles}${NC}`);
  
  jsFiles.forEach(file => {
    const relativePath = path.relative(DIST_DIR, file);
    console.log(`  JS: ${relativePath}`);
  });
  
  cssFiles.forEach(file => {
    const relativePath = path.relative(DIST_DIR, file);
    console.log(`  CSS: ${relativePath}`);
  });
}
console.log('');

// 3. Identificar arquivos órfãos
console.log(`${YELLOW}[3/8] Identificando arquivos órfãos...${NC}`);
const srcFiles = getAllFiles(SRC_DIR);
const importedFiles = new Set();

srcFiles.forEach(file => {
  if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
    const content = fs.readFileSync(file, 'utf-8');
    
    // Extrair imports
    const importMatches = content.matchAll(/import.*from\s+['"](.+?)['"]/g);
    for (const match of importMatches) {
      const importPath = match[1];
      if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
        // Import de node_modules
        continue;
      }
      
      // Resolver caminho relativo
      const resolvedPath = path.resolve(path.dirname(file), importPath);
      importedFiles.add(resolvedPath);
      importedFiles.add(resolvedPath + '.ts');
      importedFiles.add(resolvedPath + '.tsx');
      importedFiles.add(resolvedPath + '.js');
      importedFiles.add(resolvedPath + '.jsx');
      importedFiles.add(resolvedPath + '/index.ts');
      importedFiles.add(resolvedPath + '/index.tsx');
    }
  }
});

srcFiles.forEach(file => {
  if (!importedFiles.has(file) && !file.includes('index')) {
    // Verificar se é realmente órfão (não é ponto de entrada)
    const relativePath = path.relative(SRC_DIR, file);
    if (!relativePath.includes('components/ui') && !relativePath.includes('lib')) {
      auditResults.orphanFiles.push(relativePath);
    }
  }
});

console.log(`${GREEN}✓ Arquivos órfãos: ${auditResults.orphanFiles.length}${NC}`);
auditResults.orphanFiles.forEach(file => {
  console.log(`  - ${file}`);
});
console.log('');

// 4. Identificar rotas antigas
console.log(`${YELLOW}[4/8] Identificando rotas antigas...${NC}`);
const appFile = path.join(SRC_DIR, 'App.tsx');
if (fs.existsSync(appFile)) {
  const appContent = fs.readFileSync(appFile, 'utf-8');
  const routeMatches = appContent.matchAll(/path="([^"]+)"/g);
  const currentRoutes = [];
  
  for (const match of routeMatches) {
    currentRoutes.push(match[1]);
  }
  
  console.log(`${GREEN}✓ Rotas atuais: ${currentRoutes.length}${NC}`);
  currentRoutes.forEach(route => {
    console.log(`  - ${route}`);
  });
  
  // Verificar se há arquivos de páginas não usados
  const pagesDir = path.join(SRC_DIR, 'pages');
  if (fs.existsSync(pagesDir)) {
    const pageFiles = getAllFiles(pagesDir, '.tsx');
    
    pageFiles.forEach(file => {
      const fileName = path.basename(file, '.tsx');
      const fileNameLower = fileName.toLowerCase();
      
      // Verificar se a rota correspondente existe
      const routeExists = currentRoutes.some(route => {
        const routeLower = route.toLowerCase().replace(/\//g, '-');
        return routeLower.includes(fileNameLower) || fileNameLower.includes(routeLower.replace(/-/g, ''));
      });
      
      if (!routeExists && fileName !== 'NotFound') {
        auditResults.oldRoutes.push(fileName);
      }
    });
  }
  
  console.log(`${YELLOW}⚠ Rotas antigas possíveis: ${auditResults.oldRoutes.length}${NC}`);
  auditResults.oldRoutes.forEach(route => {
    console.log(`  - ${route}`);
  });
}
console.log('');

// 5. Verificar service worker
console.log(`${YELLOW}[5/8] Verificando service worker...${NC}`);
const swFiles = [
  path.join(PUBLIC_DIR, 'sw.js'),
  path.join(PUBLIC_DIR, 'service-worker.js'),
  path.join(DIST_DIR, 'sw.js'),
  path.join(DIST_DIR, 'service-worker.js'),
];

for (const swFile of swFiles) {
  if (fs.existsSync(swFile)) {
    auditResults.serviceWorker = path.relative(PROJECT_ROOT, swFile);
    console.log(`${GREEN}✓ Service worker encontrado: ${auditResults.serviceWorker}${NC}`);
    break;
  }
}

if (!auditResults.serviceWorker) {
  console.log(`${YELLOW}⚠ Service worker não encontrado (usando vite-plugin-pwa)${NC}`);
}
console.log('');

// 6. Mapear caches possíveis
console.log(`${YELLOW}[6/8] Mapeando caches possíveis...${NC}`);
const cacheDirs = [
  path.join(PROJECT_ROOT, 'node_modules', '.cache'),
  path.join(PROJECT_ROOT, '.vite'),
  path.join(PROJECT_ROOT, 'dist'),
  path.join(PROJECT_ROOT, 'build'),
];

cacheDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    const size = getDirectorySize(dir);
    auditResults.caches.push({
      path: path.relative(PROJECT_ROOT, dir),
      size: formatBytes(size),
    });
    console.log(`${GREEN}✓ Cache: ${path.relative(PROJECT_ROOT, dir)} (${formatBytes(size)})${NC}`);
  }
});
console.log('');

// 7. Identificar imports duplicados
console.log(`${YELLOW}[7/8] Identificando imports duplicados...${NC}`);
const importMap = new Map();

srcFiles.forEach(file => {
  if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
    const content = fs.readFileSync(file, 'utf-8');
    const importMatches = content.matchAll(/import.*from\s+['"](.+?)['"]/g);
    
    for (const match of importMatches) {
      const importPath = match[1];
      if (!importMap.has(importPath)) {
        importMap.set(importPath, []);
      }
      importMap.get(importPath).push(path.relative(SRC_DIR, file));
    }
  }
});

importMap.forEach((files, importPath) => {
  if (files.length > 5 && !importPath.startsWith('.')) {
    auditResults.duplicateImports.push({
      import: importPath,
      count: files.length,
    });
  }
});

console.log(`${GREEN}✓ Imports frequentes: ${auditResults.duplicateImports.length}${NC}`);
auditResults.duplicateImports.forEach(({ import: imp, count }) => {
  console.log(`  - ${imp} (${count} arquivos)`);
});
console.log('');

// 8. Identificar páginas antigas compiladas
console.log(`${YELLOW}[8/8] Identificando páginas antigas compiladas...${NC}`);
if (fs.existsSync(DIST_DIR)) {
  const distFiles = getAllFiles(DIST_DIR, '.html');
  
  distFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf-8');
    const fileName = path.basename(file);
    
    if (fileName !== 'index.html') {
      auditResults.oldCompiledPages.push(fileName);
    }
  });
  
  console.log(`${GREEN}✓ Páginas HTML compiladas: ${distFiles.length}${NC}`);
  console.log(`${YELLOW}⚠ Páginas antigas: ${auditResults.oldCompiledPages.length}${NC}`);
  auditResults.oldCompiledPages.forEach(page => {
    console.log(`  - ${page}`);
  });
}
console.log('');

// Resumo
console.log(`${BLUE}========================================${NC}`);
console.log(`${BLUE}RESUMO DA AUDITORIA${NC}`);
console.log(`${BLUE}========================================${NC}`);
console.log('');
console.log(`Builds existentes: ${auditResults.builds}`);
console.log(`Bundles ativos: ${auditResults.bundles}`);
console.log(`Arquivos órfãos: ${auditResults.orphanFiles.length}`);
console.log(`Rotas antigas: ${auditResults.oldRoutes.length}`);
console.log(`Service worker: ${auditResults.serviceWorker || 'N/A'}`);
console.log(`Caches possíveis: ${auditResults.caches.length}`);
console.log(`Imports duplicados: ${auditResults.duplicateImports.length}`);
console.log(`Páginas antigas compiladas: ${auditResults.oldCompiledPages.length}`);
console.log('');

// Salvar resultado
const reportPath = path.join(PROJECT_ROOT, 'FRONTEND_AUDIT_REPORT.json');
fs.writeFileSync(reportPath, JSON.stringify(auditResults, null, 2));
console.log(`${GREEN}✓ Relatório salvo em: ${reportPath}${NC}`);

// Funções auxiliares
function getAllFiles(dir, extension = null) {
  const files = [];
  
  if (!fs.existsSync(dir)) {
    return files;
  }
  
  const items = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    
    if (item.isDirectory()) {
      files.push(...getAllFiles(fullPath, extension));
    } else if (!extension || item.name.endsWith(extension)) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function getDirectorySize(dir) {
  let size = 0;
  
  const items = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    
    if (item.isDirectory()) {
      size += getDirectorySize(fullPath);
    } else {
      size += fs.statSync(fullPath).size;
    }
  }
  
  return size;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
