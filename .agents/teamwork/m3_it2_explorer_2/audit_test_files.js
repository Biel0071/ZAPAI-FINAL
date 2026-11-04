const fs = require('fs');
const path = require('path');

const baseDir = path.resolve(__dirname, '../../../frontend-official/src');

const testFiles = [
  'components/avatar-engine/__tests__/avatarEngine.test.ts',
  'core/lib/utils.test.ts',
  'core/utils/tagEmojis.test.ts',
  'test/activeChatSheet.test.tsx',
  'test/aiMessageFeedback.test.tsx',
  'test/aiRuntimeContracts.test.tsx',
  'test/apiAuthScope.test.ts',
  'test/apiServiceMessageTimestamps.test.ts',
  'test/attendantsComprehensiveSimulation.test.tsx',
  'test/attendantsDesignSystemAndBrainGraph.test.tsx',
  'test/attendantsUnified.test.tsx',
  'test/campaignBusinessHoursAndAvatar.test.tsx',
  'test/commercialSession.test.tsx',
  'test/conversationScoresInteractivity.test.tsx',
  'test/conversationSearch.test.tsx',
  'test/dashboardTwoHubs.test.tsx',
  'test/evolutionTabHonesty.test.tsx',
  'test/example.test.ts',
  'test/flowExecutionBanner.test.tsx',
  'test/historyBootstrap.test.tsx',
  'test/importWhatsappQuickReplies.test.ts',
  'test/inboxCatalogPopover.test.tsx',
  'test/inboxCircuitBreakerFlashingRed.test.tsx',
  'test/inboxDisparoCard.test.tsx',
  'test/inboxLabelsAndPinSync.test.ts',
  'test/inboxOrderCard.test.tsx',
  'test/inboxPanel.test.tsx',
  'test/inboxRealtimeSync.test.ts',
  'test/inboxReconstruction.test.tsx',
  'test/inboxTimestamp.test.ts',
  'test/leadAlgorithmAndFollowup.test.ts',
  'test/leadDrawerProduction.test.tsx',
  'test/mediaAccess.test.ts',
  'test/messageDedupe.test.ts',
  'test/messageFooter.test.tsx',
  'test/messageOrdering.test.ts',
  'test/mobileApp.test.tsx',
  'test/productionPages.test.tsx',
  'test/quickReplyCategoryAppearance.test.tsx',
  'test/quickReplyFlowContext.test.ts',
  'test/requestCache.test.ts',
  'test/runtimeProviderHistoryRefresh.test.ts',
  'test/runtimeProviderRealtimeMessage.test.tsx',
  'test/stackedTagsBadge.test.tsx',
  'test/storesPage.test.tsx',
  'test/unifiedAI.test.tsx',
  'test/waLabelsSlashBubble.test.tsx',
  'test/whatsappConversationMenu.test.tsx',
  'test/zaiPlatformAssistant.test.tsx'
];

console.log('Total test files:', testFiles.length);

const results = [];

for (const rel of testFiles) {
  const fullPath = path.join(baseDir, rel);
  if (!fs.existsSync(fullPath)) {
    results.push({ file: rel, error: 'File not found' });
    continue;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const lines = content.split('\n');

  const info = {
    file: rel,
    hasSetTimeout: content.includes('setTimeout'),
    hasSetInterval: content.includes('setInterval'),
    hasFakeTimers: content.includes('useFakeTimers'),
    hasAfterEach: content.includes('afterEach'),
    hasBeforeEach: content.includes('beforeEach'),
    hasDispatchEvent: content.includes('dispatchEvent'),
    hasAct: content.includes('act('),
    hasRootUnmount: content.includes('unmount'),
    importedComponents: [],
    suspiciousPatterns: []
  };

  // Find components imported
  const importMatches = content.match(/import\s+(?:{[^}]+}|\w+)\s+from\s+["']([^"']+)["']/g) || [];
  for (const imp of importMatches) {
    if (imp.includes('@/pages') || imp.includes('@/components')) {
      info.importedComponents.push(imp);
    }
  }

  // Look for setTimeout lines in test
  lines.forEach((line, idx) => {
    if (line.includes('setTimeout') || line.includes('setInterval')) {
      info.suspiciousPatterns.push({ line: idx + 1, text: line.trim() });
    }
    if (line.includes('dispatchEvent') && !line.includes('await')) {
      // Check surrounding lines for await
      const context = lines.slice(Math.max(0, idx - 2), Math.min(lines.length, idx + 3)).join(' ');
      if (!context.includes('await')) {
        info.suspiciousPatterns.push({ line: idx + 1, type: 'dispatchEvent-no-await', text: line.trim() });
      }
    }
    if (line.includes('new Promise') && !line.includes('await') && !line.includes('return')) {
      info.suspiciousPatterns.push({ line: idx + 1, type: 'floating-promise', text: line.trim() });
    }
  });

  results.push(info);
}

fs.writeFileSync(
  path.join(__dirname, 'test_files_analysis.json'),
  JSON.stringify(results, null, 2),
  'utf8'
);

console.log('Analysis complete. Results saved to test_files_analysis.json');
