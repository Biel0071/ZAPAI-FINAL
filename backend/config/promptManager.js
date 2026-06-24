const { DEFAULT_SYSTEM_PROMPT } = require('./basePrompt');

function createPromptVersion(prompt, reason = 'Initial prompt') {
  return {
    appliedAt: new Date().toISOString(),
    id: `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    prompt,
    reason,
    version: Date.now(),
  };
}

function ensurePromptHistory(store) {
  if (!Array.isArray(store.promptHistory) || store.promptHistory.length === 0) {
    store.promptHistory = [createPromptVersion(DEFAULT_SYSTEM_PROMPT)];
  }

  return store.promptHistory;
}

async function persistPromptHistory(store) {
  if (typeof store.saveAiState === 'function') {
    await store.saveAiState();
  }
}

function getActivePrompt(store) {
  const history = ensurePromptHistory(store);
  return history[history.length - 1]?.prompt || DEFAULT_SYSTEM_PROMPT;
}

function getPromptHistory(store) {
  return ensurePromptHistory(store);
}

async function applyPromptImprovement(store, improvementText, reason = 'Applied AI learning improvement') {
  const history = ensurePromptHistory(store);
  const currentPrompt = getActivePrompt(store);
  const nextPrompt = `${currentPrompt}\n\n${improvementText}`.trim();
  const version = createPromptVersion(nextPrompt, reason);

  history.push(version);
  await persistPromptHistory(store);

  return version;
}

async function updateActivePrompt(store, nextPrompt, reason = 'Manual save') {
  const history = ensurePromptHistory(store);
  const version = createPromptVersion(nextPrompt, reason);

  history.push(version);
  await persistPromptHistory(store);

  return version;
}

module.exports = {
  applyPromptImprovement,
  updateActivePrompt,
  ensurePromptHistory,
  getActivePrompt,
  getPromptHistory,
};
