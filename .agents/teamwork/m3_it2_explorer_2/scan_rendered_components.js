const fs = require('fs');
const path = require('path');

const baseDir = path.resolve(__dirname, '../../../frontend-official/src');

const tsxTestFiles = [
  'test/activeChatSheet.test.tsx',
  'test/aiMessageFeedback.test.tsx',
  'test/aiRuntimeContracts.test.tsx',
  'test/attendantsComprehensiveSimulation.test.tsx',
  'test/attendantsDesignSystemAndBrainGraph.test.tsx',
  'test/attendantsUnified.test.tsx',
  'test/campaignBusinessHoursAndAvatar.test.tsx',
  'test/commercialSession.test.tsx',
  'test/conversationScoresInteractivity.test.tsx',
  'test/conversationSearch.test.tsx',
  'test/dashboardTwoHubs.test.tsx',
  'test/evolutionTabHonesty.test.tsx',
  'test/flowExecutionBanner.test.tsx',
  'test/historyBootstrap.test.tsx',
  'test/inboxCatalogPopover.test.tsx',
  'test/inboxCircuitBreakerFlashingRed.test.tsx',
  'test/inboxDisparoCard.test.tsx',
  'test/inboxOrderCard.test.tsx',
  'test/inboxPanel.test.tsx',
  'test/inboxReconstruction.test.tsx',
  'test/leadDrawerProduction.test.tsx',
  'test/messageFooter.test.tsx',
  'test/mobileApp.test.tsx',
  'test/productionPages.test.tsx',
  'test/quickReplyCategoryAppearance.test.tsx',
  'test/runtimeProviderRealtimeMessage.test.tsx',
  'test/stackedTagsBadge.test.tsx',
  'test/storesPage.test.tsx',
  'test/unifiedAI.test.tsx',
  'test/waLabelsSlashBubble.test.tsx',
  'test/whatsappConversationMenu.test.tsx',
  'test/zaiPlatformAssistant.test.tsx'
];

function resolveImport(importPath, sourceFilePath) {
  let resolved = null;
  if (importPath.startsWith('@/')) {
    resolved = path.join(baseDir, importPath.slice(2));
  } else if (importPath.startsWith('.')) {
    resolved = path.resolve(path.dirname(sourceFilePath), importPath);
  } else {
    return null;
  }

  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'];
  for (const ext of extensions) {
    const candidate = resolved + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

const componentAnalysis = [];

for (const testRel of tsxTestFiles) {
  const fullPath = path.join(baseDir, testRel);
  const content = fs.readFileSync(fullPath, 'utf8');

  // Find imports
  const importLines = content.match(/import\s+(?:{[^}]+}|\w+(?:,\s*{[^}]+})?|\*\s+as\s+\w+)\s+from\s+["']([^"']+)["']/g) || [];

  const testReport = {
    testFile: testRel,
    importedComponents: []
  };

  for (const impLine of importLines) {
    const match = impLine.match(/from\s+["']([^"']+)["']/);
    if (!match) continue;
    const impPath = match[1];
    const resolved = resolveImport(impPath, fullPath);
    if (!resolved || resolved.includes('node_modules')) continue;

    // Check if resolved file is in pages or components
    if (resolved.includes('components') || resolved.includes('pages') || resolved.includes('state')) {
      const compContent = fs.readFileSync(resolved, 'utf8');
      const compLines = compContent.split('\n');

      const timers = [];
      compLines.forEach((l, idx) => {
        if (l.includes('setTimeout') || l.includes('setInterval')) {
          timers.push({ line: idx + 1, text: l.trim() });
        }
      });

      testReport.importedComponents.push({
        importPath: impPath,
        resolvedPath: path.relative(baseDir, resolved),
        timers
      });
    }
  }

  componentAnalysis.push(testReport);
}

fs.writeFileSync(
  path.join(__dirname, 'rendered_components_timers.json'),
  JSON.stringify(componentAnalysis, null, 2),
  'utf8'
);

console.log('Component timers scan complete.');
