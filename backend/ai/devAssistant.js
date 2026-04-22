const path = require('path');
const { analyzeProject } = require('./projectAnalyzer');
const devPipeline = require('./devPipeline');
let runCommand = async () => ({
  success: false,
  action: 'unavailable',
  message: 'ai-engine/runtime is unavailable.',
});

try {
  ({ runCommand } = require('ai-engine/runtime'));
} catch (error) {
  console.warn('[AI] runtime bridge unavailable for devAssistant:', error.message || error);
}

function normalizeCommand(value) {
  return String(value || '').trim();
}

function parseMissingApisQuestion(command) {
  return /which\s+apis\s+are\s+missing|missing\s+apis?/i.test(command);
}

function parseProjectStatusQuestion(command) {
  return /project\s+status|what\s+is\s+missing|missing\s+pages?/i.test(command);
}

async function runAssistantCommand(rawCommand, options = {}) {
  const command = normalizeCommand(rawCommand);
  if (!command) {
    return {
      success: false,
      action: 'none',
      message: 'command is required.',
    };
  }

  const generated = await runCommand(command, {
    projectRoot: path.resolve(__dirname, '..'),
  });

  if (generated?.success) {
    return {
      success: true,
      action: generated.action,
      command,
      result: generated,
    };
  }

  if (parseMissingApisQuestion(command)) {
    const analysis = await analyzeProject({ autoCreateMissingPages: false });
    return {
      success: true,
      action: 'list-missing-apis',
      command,
      missingApis: analysis.missingApis,
    };
  }

  if (parseProjectStatusQuestion(command)) {
    const { analysis, pipeline } = await devPipeline.refreshPipeline({ autoCreateMissingPages: false });
    return {
      success: true,
      action: 'project-status',
      command,
      analysis,
      pipeline,
    };
  }

  const { analysis, pipeline } = await devPipeline.refreshPipeline({ autoCreateMissingPages: false });
  return {
    success: true,
    action: 'suggest-next-steps',
    command,
    suggestions: [
      'Try: "Create a leads module"',
      'Try: "Which APIs are missing?"',
      'Try: "Project status"',
      'Try: "Activate self-improving saas engine mode"',
      'Try: "Run self-improving cycle now"',
    ],
    analysis,
    pipeline,
    options,
  };
}

module.exports = {
  runAssistantCommand,
};
