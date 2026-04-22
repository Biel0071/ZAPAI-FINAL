const systemSettingsRepository = require('../repositories/systemSettingsRepository');

let AI_ENABLED = false;

function parseBoolean(value) {
  return String(value).toLowerCase() === 'true';
}

async function initAIToggle() {
  try {
    const setting = await systemSettingsRepository.getSetting('ai_enabled');
    AI_ENABLED = setting ? parseBoolean(setting.value) : false;
  } catch (error) {
    console.warn('[AI] failed to load persisted toggle:', error.message || error);
  }

  return AI_ENABLED;
}

async function setAIEnabled(value) {
  AI_ENABLED = Boolean(value);

  try {
    await systemSettingsRepository.setSetting('ai_enabled', String(AI_ENABLED));
  } catch (error) {
    console.warn('[AI] failed to persist toggle:', error.message || error);
  }

  console.log(AI_ENABLED ? '[AI] enabled' : '[AI] disabled');
  return AI_ENABLED;
}

async function enableAI() {
  return setAIEnabled(true);
}

async function disableAI() {
  return setAIEnabled(false);
}

function isAIEnabled() {
  return AI_ENABLED;
}

module.exports = {
  disableAI,
  enableAI,
  initAIToggle,
  isAIEnabled,
  setAIEnabled,
};
