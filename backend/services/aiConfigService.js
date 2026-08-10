const { businessHours } = require('../src/infrastructure/config/businessHours');

const DEFAULT_MEMORY_SETTINGS = {
  enabled: true,
  rememberLastOrder: true,
  rememberPreferences: true,
};

const DEFAULT_ADVANCED_AI_SETTINGS = {
  temperature: 0.6,
  maxTokens: 600,
  responseDelaySeconds: 1,
  autoFollowUp: true,
};

const DEFAULT_QUEUE_SETTINGS = {
  batchSize: 20,
  delaySeconds: 10,
  reactivationMessage: 'Oi! Estou retomando seu atendimento. Posso seguir com seu pedido?',
};

function ensureStoreConfig(store) {
  if (!store.aiConfig || typeof store.aiConfig !== 'object') {
    store.aiConfig = {};
  }

  if (!store.aiConfig.memorySettings) {
    store.aiConfig.memorySettings = { ...DEFAULT_MEMORY_SETTINGS };
  }

  if (!store.aiConfig.advancedAISettings) {
    store.aiConfig.advancedAISettings = { ...DEFAULT_ADVANCED_AI_SETTINGS };
  }

  if (!store.aiConfig.queueSettings) {
    store.aiConfig.queueSettings = { ...DEFAULT_QUEUE_SETTINGS };
  }

  return store.aiConfig;
}

function getBusinessHoursSettings() {
  return {
    autoReplyOutsideHours: businessHours.autoReplyOutsideHours !== false,
    closeTime: businessHours.close,
    openTime: businessHours.open,
    timezone: businessHours.timezone,
  };
}

function saveBusinessHoursSettings(store, payload = {}) {
  businessHours.open = String(payload.openTime || businessHours.open);
  businessHours.close = String(payload.closeTime || businessHours.close);
  businessHours.timezone = String(payload.timezone || businessHours.timezone);
  businessHours.autoReplyOutsideHours = payload.autoReplyOutsideHours !== undefined ? Boolean(payload.autoReplyOutsideHours) : businessHours.autoReplyOutsideHours;

  if (store) {
    const config = ensureStoreConfig(store);
    config.businessHours = {
      open: businessHours.open,
      close: businessHours.close,
      timezone: businessHours.timezone,
      autoReplyOutsideHours: businessHours.autoReplyOutsideHours,
      absenceMessage: businessHours.absenceMessage,
    };
  }

  return getBusinessHoursSettings();
}

function getAbsenceMessageSettings() {
  return {
    enabled: true,
    message: businessHours.absenceMessage,
  };
}

function saveAbsenceMessageSettings(store, payload = {}) {
  businessHours.absenceMessage = String(payload.message || businessHours.absenceMessage);

  if (store) {
    const config = ensureStoreConfig(store);
    config.businessHours = {
      open: businessHours.open,
      close: businessHours.close,
      timezone: businessHours.timezone,
      absenceMessage: businessHours.absenceMessage,
    };
  }

  return getAbsenceMessageSettings();
}

function getMemorySettings(store) {
  const config = ensureStoreConfig(store);
  return {
    ...DEFAULT_MEMORY_SETTINGS,
    ...config.memorySettings,
  };
}

function saveMemorySettings(store, payload = {}) {
  const config = ensureStoreConfig(store);
  config.memorySettings = {
    ...getMemorySettings(store),
    ...payload,
  };

  return config.memorySettings;
}

function getAdvancedAISettings(store) {
  const config = ensureStoreConfig(store);
  return {
    ...DEFAULT_ADVANCED_AI_SETTINGS,
    ...config.advancedAISettings,
  };
}

function saveAdvancedAISettings(store, payload = {}) {
  const config = ensureStoreConfig(store);
  config.advancedAISettings = {
    ...getAdvancedAISettings(store),
    ...payload,
  };

  return config.advancedAISettings;
}

function getQueueSettings(store) {
  const config = ensureStoreConfig(store);
  return {
    ...DEFAULT_QUEUE_SETTINGS,
    ...config.queueSettings,
    customersWaiting: Array.isArray(store.conversations) ? store.conversations.length : 0,
    messagesSentToday: Array.isArray(store.messages) ? store.messages.length : 0,
  };
}

function saveQueueSettings(store, payload = {}) {
  const config = ensureStoreConfig(store);
  config.queueSettings = {
    ...getQueueSettings(store),
    ...payload,
  };

  return config.queueSettings;
}

function processQueue(store, payload = {}) {
  const queueSettings = saveQueueSettings(store, payload);
  const batchSize = Number(queueSettings.batchSize) || 0;
  const customersWaiting = Array.isArray(store.conversations) ? store.conversations.length : 0;
  const messagesSent = Math.max(0, Math.min(batchSize, customersWaiting));

  return {
    messagesSent,
    success: true,
  };
}

function improveAIResponse(payload = {}) {
  const customerQuestion = String(payload.customerQuestion || '').trim();
  const aiResponse = String(payload.aiResponse || '').trim();
  const status = String(payload.status || '').trim().toLowerCase();

  if (!customerQuestion || !aiResponse) {
    throw new Error('customerQuestion and aiResponse are required.');
  }

  const actionHint =
    status === 'lost'
      ? 'retome com prova social, pergunta objetiva e próximo passo claro'
      : 'confirme necessidade, reforce valor e conduza para fechamento';

  return {
    improvedResponse: `${aiResponse}\n\nAjuste sugerido: ${actionHint}.`,
    suggestion: `Reescreva em até 3 frases, mantenha tom consultivo e termine com pergunta de avanço para: "${customerQuestion}".`,
  };
}

module.exports = {
  getAbsenceMessageSettings,
  getAdvancedAISettings,
  getBusinessHoursSettings,
  getMemorySettings,
  getQueueSettings,
  improveAIResponse,
  processQueue,
  saveAbsenceMessageSettings,
  saveAdvancedAISettings,
  saveBusinessHoursSettings,
  saveMemorySettings,
  saveQueueSettings,
};
