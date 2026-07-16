const DEFAULT_HUMAN_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_AI_ITERATIONS = 3;
const DUPLICATE_WINDOW_MS = 2 * 60 * 1000;

function normalizeText(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function makeHash(value) {
  const normalized = normalizeText(value);
  let hash = 0;

  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }

  return `${normalized.length}:${hash}`;
}

function ensureRuntimeStore(store) {
  if (!store || typeof store !== 'object') {
    return null;
  }

  if (!store.conversationRuntime || typeof store.conversationRuntime !== 'object') {
    store.conversationRuntime = {};
  }

  return store.conversationRuntime;
}

function createDefaultRuntime() {
  return {
    aiIterationCount: 0,
    aiPausedUntil: null,
    controlMode: 'ai_active',
    humanTimeoutMs: DEFAULT_HUMAN_TIMEOUT_MS,
    lastAIResponseAt: null,
    lastAIResponseHash: null,
    lastIncomingAt: null,
    lastIncomingHash: null,
    lastUpdatedAt: new Date().toISOString(),
  };
}

function getConversationRuntime(store, conversationId) {
  const runtimeStore = ensureRuntimeStore(store);

  if (!runtimeStore || !conversationId) {
    return createDefaultRuntime();
  }

  const key = String(conversationId);
  if (!runtimeStore[key]) {
    runtimeStore[key] = createDefaultRuntime();
  }

  return runtimeStore[key];
}

function setConversationRuntime(store, conversationId, patch = {}) {
  const runtimeStore = ensureRuntimeStore(store);

  if (!runtimeStore || !conversationId) {
    return createDefaultRuntime();
  }

  const key = String(conversationId);
  const current = getConversationRuntime(store, key);
  runtimeStore[key] = {
    ...current,
    ...patch,
    lastUpdatedAt: new Date().toISOString(),
  };

  return runtimeStore[key];
}

function applyTimeout(runtime) {
  if (!runtime?.aiPausedUntil) {
    return runtime;
  }

  const deadline = Date.parse(runtime.aiPausedUntil) || 0;
  if (!deadline || Date.now() < deadline) {
    return runtime;
  }

  return {
    ...runtime,
    aiPausedUntil: null,
    controlMode: 'ai_active',
  };
}

function refreshExpiredHumanTakeover(store, conversationId) {
  const current = getConversationRuntime(store, conversationId);
  const wasHumanTakeover = current?.controlMode === 'human_active' || current?.controlMode === 'paused_ai';
  const deadline = Date.parse(current?.aiPausedUntil || '') || 0;
  const expired = Boolean(wasHumanTakeover && deadline && Date.now() >= deadline);
  const runtime = applyTimeout(current);

  if (runtime !== current) {
    setConversationRuntime(store, conversationId, runtime);
  }

  return {
    expired,
    runtime,
  };
}

function decorateConversation(store, conversation) {
  if (!conversation) {
    return conversation;
  }

  const runtime = applyTimeout(getConversationRuntime(store, conversation.id));

  if (runtime !== getConversationRuntime(store, conversation.id)) {
    setConversationRuntime(store, conversation.id, runtime);
  }

  return {
    ...conversation,
    aiPausedUntil: runtime.aiPausedUntil,
    controlMode: runtime.controlMode,
    humanActive: runtime.controlMode === 'human_active' || runtime.controlMode === 'paused_ai',
    maxAiIterations: DEFAULT_MAX_AI_ITERATIONS,
  };
}

function setHumanTakeover(store, conversationId, timeoutMs = DEFAULT_HUMAN_TIMEOUT_MS) {
  const safeTimeout = Number(timeoutMs) > 0 ? Number(timeoutMs) : DEFAULT_HUMAN_TIMEOUT_MS;
  const pausedUntil = new Date(Date.now() + safeTimeout).toISOString();

  return setConversationRuntime(store, conversationId, {
    aiIterationCount: 0,
    aiPausedUntil: pausedUntil,
    controlMode: 'human_active',
    humanTimeoutMs: safeTimeout,
  });
}

function resumeAI(store, conversationId) {
  return setConversationRuntime(store, conversationId, {
    aiIterationCount: 0,
    aiPausedUntil: null,
    controlMode: 'ai_active',
  });
}

function registerIncomingMessage(store, conversationId, text = '') {
  const runtime = applyTimeout(getConversationRuntime(store, conversationId));
  const nextHash = makeHash(text);

  return setConversationRuntime(store, conversationId, {
    ...runtime,
    lastIncomingAt: new Date().toISOString(),
    lastIncomingHash: nextHash,
  });
}

function registerHumanReply(store, conversationId, timeoutMs = DEFAULT_HUMAN_TIMEOUT_MS) {
  return setHumanTakeover(store, conversationId, timeoutMs);
}

function canRunAI(store, conversationId, incomingText = '') {
  const current = applyTimeout(getConversationRuntime(store, conversationId));

  if (current.controlMode === 'human_active' || current.controlMode === 'paused_ai') {
    const deadline = Date.parse(current.aiPausedUntil || '') || 0;
    if (deadline && Date.now() < deadline) {
      return {
        allow: false,
        reason: 'human_active',
        runtime: current,
      };
    }
  }

  const incomingHash = makeHash(incomingText);
  const incomingAt = Date.parse(current.lastIncomingAt || '') || 0;

  if (incomingHash && current.lastIncomingHash === incomingHash && Date.now() - incomingAt < 4000) {
    return {
      allow: false,
      reason: 'duplicate_incoming',
      runtime: current,
    };
  }

  if (Number(current.aiIterationCount || 0) >= DEFAULT_MAX_AI_ITERATIONS) {
    return {
      allow: false,
      reason: 'max_iterations',
      runtime: current,
    };
  }

  const updated = setConversationRuntime(store, conversationId, {
    ...current,
    aiIterationCount: Number(current.aiIterationCount || 0) + 1,
  });

  return {
    allow: true,
    reason: 'ok',
    runtime: updated,
  };
}

function canSendAIResponse(store, conversationId, text = '') {
  const current = applyTimeout(getConversationRuntime(store, conversationId));
  const nextHash = makeHash(text);
  const lastAt = Date.parse(current.lastAIResponseAt || '') || 0;

  if (nextHash && current.lastAIResponseHash === nextHash && Date.now() - lastAt < DUPLICATE_WINDOW_MS) {
    return {
      allow: false,
      reason: 'duplicate_ai_response',
      runtime: current,
    };
  }

  const updated = setConversationRuntime(store, conversationId, {
    ...current,
    controlMode: 'ai_active',
    lastAIResponseAt: new Date().toISOString(),
    lastAIResponseHash: nextHash,
  });

  return {
    allow: true,
    reason: 'ok',
    runtime: updated,
  };
}

module.exports = {
  DEFAULT_HUMAN_TIMEOUT_MS,
  DEFAULT_MAX_AI_ITERATIONS,
  canRunAI,
  canSendAIResponse,
  decorateConversation,
  getConversationRuntime,
  refreshExpiredHumanTakeover,
  registerHumanReply,
  registerIncomingMessage,
  resumeAI,
  setHumanTakeover,
};
