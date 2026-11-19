const fs = require('fs');
const path = require('path');

const baseDir = path.resolve(__dirname, '../../../frontend-official/src');

const filesToCheck = [
  'pages/Inbox/components/ActiveChatPane.tsx',
  'pages/AI/OperationsTab.tsx',
  'pages/Attendants/AttendantsPage.tsx',
  'pages/Inbox/components/SidebarPanel.tsx',
  'pages/Campaigns.tsx',
  'components/evolution/HistoryBootstrapPanel.tsx',
  'pages/Inbox/hooks/useInboxState.ts',
  'pages/Inbox.tsx',
  'pages/Dashboard.tsx',
  'pages/Inbox/components/FlowExecutionBanner.tsx',
  'pages/Inbox/components/CatalogSelectorPopover.tsx',
  'pages/Inbox/components/MessageRow.tsx',
  'pages/Inbox/components/QuickResponseModal.tsx',
  'pages/Inbox/components/ZaiAssistantComposer.tsx',
  'components/contacts/LeadDrawer.tsx',
  'pages/Connections.tsx',
  'state/providers/RuntimeProvider.tsx',
  'components/layout/Sidebar.tsx'
];

const results = [];

for (const rel of filesToCheck) {
  const fullPath = path.join(baseDir, rel);
  if (!fs.existsSync(fullPath)) continue;

  const content = fs.readFileSync(fullPath, 'utf8');

  // Check setInterval
  const intervalMatches = content.match(/setInterval/g) || [];
  const clearIntervalMatches = content.match(/clearInterval/g) || [];

  // Check setTimeout
  const timeoutMatches = content.match(/setTimeout/g) || [];
  const clearTimeoutMatches = content.match(/clearTimeout/g) || [];

  results.push({
    file: rel,
    setIntervalCount: intervalMatches.length,
    clearIntervalCount: clearIntervalMatches.length,
    setTimeoutCount: timeoutMatches.length,
    clearTimeoutCount: clearTimeoutMatches.length,
    hasEventTimeout: /const\s+handle\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>[\s\S]*?setTimeout/.test(content)
  });
}

console.log(JSON.stringify(results, null, 2));
