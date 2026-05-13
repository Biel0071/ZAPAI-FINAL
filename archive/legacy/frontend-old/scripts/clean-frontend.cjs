/**
 * ============================================================================
 * FRONTEND CLEAN SCRIPT
 * ============================================================================
 * 
 * Limpa builds antigos, arquivos órfãos e caches.
 * Deixa somente build atual.
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const BUILD_DIRS = ['dist-temp', 'dist-backup', 'dist-old'];
const CACHE_DIRS = ['.vite', 'node_modules/.cache'];

// Colors
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const NC = '\x1b[0m';

console.log(`${BLUE}========================================${NC}`);
console.log(`${BLUE}FRONTEND CLEAN${NC}`);
console.log(`${BLUE}========================================${NC}`);
console.log('');

// 1. Limpar builds antigos
console.log(`${YELLOW}[1/3] Limpando builds antigos...${NC}`);
BUILD_DIRS.forEach(dir => {
  const fullPath = path.join(PROJECT_ROOT, dir);
  if (fs.existsSync(fullPath)) {
    fs.rmSync(fullPath, { recursive: true, force: true });
    console.log(`${GREEN}✓ Removido: ${dir}${NC}`);
  } else {
    console.log(`${YELLOW}⚠ Não encontrado: ${dir}${NC}`);
  }
});
console.log('');

// 2. Limpar caches
console.log(`${YELLOW}[2/3] Limpando caches...${NC}`);
CACHE_DIRS.forEach(dir => {
  const fullPath = path.join(PROJECT_ROOT, dir);
  if (fs.existsSync(fullPath)) {
    fs.rmSync(fullPath, { recursive: true, force: true });
    console.log(`${GREEN}✓ Removido: ${dir}${NC}`);
  } else {
    console.log(`${YELLOW}⚠ Não encontrado: ${dir}${NC}`);
  }
});
console.log('');

// 3. Limpar dist atual e recriar
console.log(`${YELLOW}[3/3] Limpando dist atual...${NC}`);
if (fs.existsSync(DIST_DIR)) {
  fs.rmSync(DIST_DIR, { recursive: true, force: true });
  console.log(`${GREEN}✓ Removido: dist${NC}`);
}
fs.mkdirSync(DIST_DIR, { recursive: true });
console.log(`${GREEN}✓ Recriado: dist${NC}`);
console.log('');

console.log(`${BLUE}========================================${NC}`);
console.log(`${GREEN}LIMPEZA CONCLUÍDA!${NC}`);
console.log(`${BLUE}========================================${NC}`);
console.log('');
console.log(`${YELLOW}Próximo passo:${NC}`);
console.log(`  npm run build:prod`);
console.log(`  npm run validate-build`);
console.log('');
