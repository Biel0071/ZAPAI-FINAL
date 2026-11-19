const fs = require('fs');
const path = require('path');

const baseDir = path.resolve(__dirname, '../../../frontend-official/src/test');

const targetFiles = [
  'attendantsComprehensiveSimulation.test.tsx',
  'attendantsDesignSystemAndBrainGraph.test.tsx',
  'attendantsUnified.test.tsx',
  'dashboardTwoHubs.test.tsx',
  'productionPages.test.tsx',
  'unifiedAI.test.tsx',
  'zaiPlatformAssistant.test.tsx',
  'stackedTagsBadge.test.tsx',
  'inboxPanel.test.tsx',
  'historyBootstrap.test.tsx',
  'mobileApp.test.tsx'
];

for (const file of targetFiles) {
  const content = fs.readFileSync(path.join(baseDir, file), 'utf8');
  console.log(`\n========================================\nFILE: ${file}\n========================================`);

  // Check afterEach
  const hasAfterEach = content.includes('afterEach');
  console.log('has afterEach:', hasAfterEach);

  // Print afterEach block
  if (hasAfterEach) {
    const afterEachMatch = content.match(/afterEach\s*\([\s\S]*?\n\s*\}\);?/g);
    if (afterEachMatch) {
      afterEachMatch.forEach(m => console.log('afterEach block:\n', m));
    }
  }
}
