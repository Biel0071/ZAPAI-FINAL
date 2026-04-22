const fs = require('fs/promises');
const path = require('path');

const TARGET_FOLDERS = ['controllers', 'services', 'routes', 'repositories'];

function inspectContent(filePath, content) {
  const issues = [];
  const lineCount = content.split(/\r?\n/).length;

  if (lineCount > 220) {
    issues.push({ rule: 'large_function_or_file', severity: 'warning' });
  }

  if (/startSession\(.+forceNew/.test(content) && /startupPromises/.test(content) === false) {
    issues.push({ rule: 'duplicate_session_creation_risk', severity: 'error' });
  }

  if (/new Promise\(/.test(content) && !/catch\(/.test(content)) {
    issues.push({ rule: 'unhandled_promises', severity: 'warning' });
  }

  if (/setInterval\(/.test(content) && !/clearInterval\(/.test(content)) {
    issues.push({ rule: 'memory_leak_risk', severity: 'warning' });
  }

  if (/catch \{\s*\/\/ ignore/.test(content)) {
    issues.push({ rule: 'missing_error_handling', severity: 'warning' });
  }

  return issues.map((issue) => ({ ...issue, filePath }));
}

async function scanFolder(rootPath, folderName) {
  const folderPath = path.join(rootPath, folderName);
  const entries = await fs.readdir(folderPath, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const entryPath = path.join(folderPath, entry.name);

    if (entry.isDirectory()) {
      continue;
    }

    if (!entry.name.endsWith('.js')) {
      continue;
    }

    const content = await fs.readFile(entryPath, 'utf8');
    results.push(...inspectContent(entryPath, content));
  }

  return results;
}

async function runInspection(rootPath) {
  const issues = [];

  for (const folderName of TARGET_FOLDERS) {
    try {
      issues.push(...(await scanFolder(rootPath, folderName)));
    } catch {
      // ignore missing folders
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    issueCount: issues.length,
    issues,
  };

  const logsPath = path.join(rootPath, 'logs');
  await fs.mkdir(logsPath, { recursive: true });
  await fs.writeFile(
    path.join(logsPath, 'ai_analysis_report.json'),
    JSON.stringify(report, null, 2)
  );

  const suggestions = [
    '# AI Suggestions',
    '',
    ...issues.map((issue) => `- ${issue.rule} in ${issue.filePath}`),
  ].join('\n');

  await fs.writeFile(path.join(logsPath, 'ai_suggestions.md'), suggestions);

  return report;
}

if (require.main === module) {
  runInspection(process.cwd()).then((report) => {
    console.log(`AI inspection completed with ${report.issueCount} issues.`);
  });
}

module.exports = {
  runInspection,
};
