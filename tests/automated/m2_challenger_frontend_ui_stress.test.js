'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const FRONTEND_SRC = path.resolve(__dirname, '../../frontend-official/src');

function getTsxFiles(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'test' && entry.name !== '__tests__') {
        results = results.concat(getTsxFiles(full));
      }
    } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
      results.push(full);
    }
  }
  return results;
}

test('Challenger Stress 1: Exhaustive AST scan for manual sync click handlers across all frontend files', () => {
  const files = getTsxFiles(FRONTEND_SRC);
  const violations = [];

  const prohibitedHandlerRegex = /onClick\s*=\s*\{(?:\s*\(\s*\)\s*=>\s*(?:void\s+)?)?([a-zA-Z0-9_$.]+)[^}]*\}/g;

  for (const file of files) {
    const relPath = path.relative(FRONTEND_SRC, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = prohibitedHandlerRegex.exec(content)) !== null) {
      const handlerName = match[1];
      if (/(?<!a)sync|sincroniz/i.test(handlerName) && handlerName !== 'async') {
        // Exclude DevOps pages (MasterDeployments refresh / MasterVersions fetchVersions)
        if (!relPath.startsWith('pages/Master')) {
          violations.push({ file: relPath, handler: handlerName, snippet: match[0] });
        }
      }
    }
  }

  assert.deepEqual(violations, [], `Found prohibited sync click handlers bound in UI:\n${JSON.stringify(violations, null, 2)}`);
});

test('Challenger Stress 2: Scan for prohibited action button labels across all components and pages', () => {
  const files = getTsxFiles(FRONTEND_SRC);
  const violations = [];

  // Exact button tags
  const buttonRegex = /<(?:Button|button)\b([^>]*)>([\s\S]*?)<\/(?:Button|button)>/g;

  for (const file of files) {
    const relPath = path.relative(FRONTEND_SRC, file).replace(/\\/g, '/');
    if (relPath.startsWith('pages/Master')) continue; // skip DevOps admin center

    const content = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = buttonRegex.exec(content)) !== null) {
      const text = match[2].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      // Check if button text commands a manual sync action
      if (/^(?:sincronizar|sincronize|sincronizando|sync|resync|retomar sincronização)/i.test(text) ||
          /(?:sincronizar cat[aá]logo|sincronizar \(sync\)|aprender dos atendimentos|sincronizar dados|sincronizar no postgresql|enviar p\/ erp)/i.test(text)) {
        violations.push({ file: relPath, text, snippet: match[0] });
      }
    }
  }

  assert.deepEqual(violations, [], `Found action buttons commanding manual sync:\n${JSON.stringify(violations, null, 2)}`);
});

test('Challenger Stress 3: Connections.tsx connection state change never invokes modal open functions', () => {
  const connectionsPath = path.join(FRONTEND_SRC, 'pages/Connections.tsx');
  const content = fs.readFileSync(connectionsPath, 'utf8');

  // Verify that the effect responding to status changes only closes modals
  const effectRegex = /safeSessions\.forEach\(\(s\)\s*=>\s*\{([\s\S]*?)\}\);/g;
  let match = effectRegex.exec(content);
  assert.ok(match, 'Connection status transition effect must exist in Connections.tsx');

  const effectBody = match[1];

  // Must not open history modal
  assert.ok(!effectBody.includes('handleOpenHistoryModal'), 'Status transition effect must NOT call handleOpenHistoryModal');
  // Must not open activation dialog
  assert.ok(!effectBody.includes('setIsActivationDialogOpen(true)'), 'Status transition effect must NOT open activation dialog');
  // Must not show QR modal
  assert.ok(!effectBody.includes('setShowQRModal(true)'), 'Status transition effect must NOT open QR modal');
  // Must explicitly close modals on connected
  assert.ok(effectBody.includes('setIsActivationDialogOpen(false)'), 'Status transition must close activation dialog on connect');
  assert.ok(effectBody.includes('setShowQRModal(false)'), 'Status transition must close QR modal on connect');
});

test('Challenger Stress 4: WebBridgeCard does not offer manual sync or invoke syncWebBridgeCatalog', () => {
  const cardPath = path.join(FRONTEND_SRC, 'components/connections/WebBridgeCard.tsx');
  const content = fs.readFileSync(cardPath, 'utf8');

  assert.ok(!content.includes('syncWebBridgeCatalog'), 'WebBridgeCard must not invoke syncWebBridgeCatalog');
  assert.ok(!content.includes('Sincronizar Catálogo Agora'), 'WebBridgeCard must not render Sincronizar Catálogo Agora');
  assert.ok(content.includes('Sincronização contínua ativa'), 'WebBridgeCard must display continuous background sync indicator');
});

test('Challenger Stress 5: Verify ActiveChatPane status banners do not block chat interface', () => {
  const panePath = path.join(FRONTEND_SRC, 'pages/Inbox/components/ActiveChatPane.tsx');
  const content = fs.readFileSync(panePath, 'utf8');

  // Ensure "Sincronização de histórico solicitada..." banner is absent
  assert.ok(!content.includes('Sincronização de histórico solicitada'), 'Disruptive sync requested banner must not be present in ActiveChatPane');
  // Ensure "Falha ao sincronizar histórico..." banner is absent
  assert.ok(!content.includes('Falha ao sincronizar histórico'), 'Disruptive sync failure banner must not be present in ActiveChatPane');
});

test('Challenger Stress 6: OrderSheetModal does not contain manual ERP Webhook sync button', () => {
  const orderSheetPath = path.join(FRONTEND_SRC, 'pages/Inbox/components/OrderSheetModal.tsx');
  const content = fs.readFileSync(orderSheetPath, 'utf8');

  assert.ok(!content.includes('Enviar p/ ERP (Webhook)'), 'OrderSheetModal must not render manual ERP sync button');
});
