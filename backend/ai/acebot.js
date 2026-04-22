const architectAgent = require('./agents/architectAgent');
const uiAnalyzerAgent = require('./agents/uiAnalyzerAgent');
const modulePlannerAgent = require('./agents/modulePlannerAgent');
const codeGeneratorAgent = require('./agents/codeGeneratorAgent');
const testAgent = require('./agents/testAgent');
const path = require('path');
let runCommand = async () => ({
  success: false,
  action: 'unavailable',
  message: 'ai-engine/runtime is unavailable.',
});

try {
  ({ runCommand } = require('ai-engine/runtime'));
} catch (error) {
  console.warn('[AI] runtime bridge unavailable for acebot:', error.message || error);
}

const agentMap = {
  architectAgent,
  uiAnalyzerAgent,
  modulePlannerAgent,
  codeGeneratorAgent,
  testAgent,
};

async function runWorkflow(payload = {}) {
  const command = String(payload.command || '').trim();
  if (command) {
    return runCommand(command, {
      projectRoot: path.resolve(__dirname, '..'),
      premiumUI: Boolean(payload.premiumUI),
    });
  }

  const execute = Array.isArray(payload.execute) && payload.execute.length
    ? payload.execute
    : ['architectAgent', 'modulePlannerAgent', 'uiAnalyzerAgent'];

  const results = {};

  for (const agentName of execute) {
    const agent = agentMap[agentName];
    if (!agent || typeof agent.run !== 'function') {
      results[agentName] = { error: `Unknown agent: ${agentName}` };
      continue;
    }

    try {
      results[agentName] = await agent.run(payload);
    } catch (error) {
      results[agentName] = {
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      };
    }
  }

  return {
    orchestrator: 'acebot',
    generatedAt: new Date().toISOString(),
    execute,
    results,
  };
}

async function createModule(moduleName) {
  const command = `create module ${String(moduleName || '').trim()}`;
  return runCommand(command, {
    projectRoot: path.resolve(__dirname, '..'),
    premiumUI: true,
  });
}

async function startSelfImprovingMode(options = {}) {
  const smartDecisionMode = options.smartDecisionMode === true;
  return runCommand(
    smartDecisionMode ? 'activate smart decision engine mode' : 'activate self-improving saas engine mode',
    {
    projectRoot: path.resolve(__dirname, '..'),
    intervalMs: options.intervalMs,
    autoApply: options.autoApply,
    smartDecisionMode,
    source: 'acebot-api',
  }
  );
}

async function startSmartSelfImprovingMode(options = {}) {
  return runCommand('activate self-improving mode', {
    projectRoot: path.resolve(__dirname, '..'),
    intervalMs: Number(options.intervalMs) || 60000,
    autoApply: options.autoApply,
    smartDecisionMode: true,
    source: 'acebot-api',
  });
}

async function stopSelfImprovingMode() {
  return runCommand('stop self-improving saas engine mode', {
    projectRoot: path.resolve(__dirname, '..'),
    source: 'acebot-api',
  });
}

async function getSelfImprovingStatus() {
  return runCommand('self-improving status', {
    projectRoot: path.resolve(__dirname, '..'),
    source: 'acebot-api',
  });
}

async function runSelfImprovementCycle(options = {}) {
  const smartDecisionMode = options.smartDecisionMode === true;
  return runCommand(smartDecisionMode ? 'run smart decision mode now' : 'run self-improving cycle now', {
    projectRoot: path.resolve(__dirname, '..'),
    autoApply: options.autoApply,
    smartDecisionMode,
    source: 'acebot-api',
  });
}

module.exports = {
  getSelfImprovingStatus,
  runWorkflow,
  createModule,
  runSelfImprovementCycle,
  startSmartSelfImprovingMode,
  startSelfImprovingMode,
  stopSelfImprovingMode,
};
