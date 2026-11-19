'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const FRONTEND_SRC = path.resolve(__dirname, '../../frontend-official/src');

// 1. Prohibited UI Text Patterns (User-Facing Manual Sync Buttons/Banners)
const PROHIBITED_BUTTON_TEXTS = [
  /Sincronizar Cat[aá]logo Agora/i,
  /Sincronizando Cat[aá]logo\.\.\./i,
  /Sincronizar \(Sync\)/i,
  /Minerando Atendimentos\.\.\./i,
  /Aprender dos Atendimentos Manuais/i,
  /Sincronizar dados das conversas/i,
  /Detectando fatos\.\.\./i,
  /Sincronizar no PostgreSQL/i,
  /Enviar p\/ ERP \(Webhook\)/i,
];

// 2. Prohibited Click Handlers in Target Files
const PROHIBITED_HANDLERS = [
  'handleSyncCatalog',
  'handleSyncRealAttendance',
  'handleSyncManual',
  'handleSyncFacts',
  'handleSyncWhatsApp',
  'handleSyncErp',
];

// Recursively get all .tsx and .ts files
function getSourceFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'test' && file !== '__tests__' && file !== 'node_modules') {
        results = results.concat(getSourceFiles(fullPath));
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

test('Requirement 1.1: Zero prohibited manual sync button text in frontend components', () => {
  const files = getSourceFiles(FRONTEND_SRC);
  const violations = [];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const pattern of PROHIBITED_BUTTON_TEXTS) {
      if (pattern.test(content)) {
        violations.push({
          file: path.relative(FRONTEND_SRC, filePath),
          pattern: pattern.toString(),
        });
      }
    }
  }

  assert.equal(
    violations.length,
    0,
    `Found prohibited manual sync button text:\n${JSON.stringify(violations, null, 2)}`
  );
});

test('Requirement 1.2: Prohibited manual sync click handlers removed from production files', () => {
  const files = getSourceFiles(FRONTEND_SRC);
  const violations = [];

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const handler of PROHIBITED_HANDLERS) {
      // Check if handler is bound to an onClick or rendered button
      const onClickRegex = new RegExp(`onClick=\\{[^}]*\\b${handler}\\b[^}]*\\}`, 'g');
      if (onClickRegex.test(content)) {
        violations.push({
          file: path.relative(FRONTEND_SRC, filePath),
          handler,
        });
      }
    }
  }

  assert.equal(
    violations.length,
    0,
    `Found prohibited manual sync handlers bound to UI:\n${JSON.stringify(violations, null, 2)}`
  );
});

test('Requirement 1.3: Connections.tsx does not auto-open popup modal on session connected', () => {
  const connectionsPath = path.join(FRONTEND_SRC, 'pages/Connections.tsx');
  const content = fs.readFileSync(connectionsPath, 'utf8');

  // Verify that handleOpenHistoryModal is not invoked inside the status transition useEffect
  const autoModalPattern = /if\s*\([^)]*status\s*===\s*["']connected["'][^)]*\)\s*\{[^}]*handleOpenHistoryModal/s;
  const hasAutoPopup = autoModalPattern.test(content);

  assert.equal(
    hasAutoPopup,
    false,
    'Connections.tsx must not automatically open history/sync popup modal when session connects'
  );
});

test('Requirement 1.4: WebBridgeCard has no manual sync modal dialog or manual sync trigger', () => {
  const cardPath = path.join(FRONTEND_SRC, 'components/connections/WebBridgeCard.tsx');
  const content = fs.readFileSync(cardPath, 'utf8');

  assert.ok(!content.includes('Sincronizar Catálogo Agora'), 'WebBridgeCard must not render Sincronizar Catálogo Agora');
  assert.ok(!content.includes('apiService.syncWebBridgeCatalog'), 'WebBridgeCard must not invoke manual sync API');
});
