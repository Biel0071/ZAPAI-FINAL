const runningFlows = new Map();
const { emitToTenant } = require('./realtime/tenantRooms');

function normalizeDigits(val) {
  return String(val || '').replace(/\D/g, '');
}

function scopeKey(chatId, { companyId = 'default', sessionId = 'default', conversationId } = {}) {
  return JSON.stringify([companyId, sessionId || 'default', conversationId || chatId]);
}

function snapshot(flowData) {
  return flowData ? { ...flowData } : flowData;
}

function findRunningEntry(chatId, scope = {}) {
  const primaryKey = scopeKey(chatId, scope);
  if (runningFlows.has(primaryKey)) {
    return { key: primaryKey, flowData: runningFlows.get(primaryKey) };
  }

  const phoneClean = normalizeDigits(chatId);
  const targetConvId = scope.conversationId ? String(scope.conversationId) : null;
  const targetFlowRunId = scope.flowRunId ? String(scope.flowRunId) : null;
  const targetCompany = scope.companyId || null;

  for (const [key, data] of runningFlows.entries()) {
    if (targetCompany && data.companyId && data.companyId !== targetCompany) continue;
    if (targetFlowRunId && data.flowRunId && data.flowRunId === targetFlowRunId) {
      return { key, flowData: data };
    }
    if (targetConvId && data.conversationId && String(data.conversationId) === targetConvId) {
      return { key, flowData: data };
    }
    if (phoneClean && data.chatId) {
      const dataPhoneClean = normalizeDigits(data.chatId);
      if (dataPhoneClean && (dataPhoneClean === phoneClean || dataPhoneClean.endsWith(phoneClean) || phoneClean.endsWith(dataPhoneClean))) {
        return { key, flowData: data };
      }
    }
  }
  return null;
}

/**
 * Starts tracking a flow execution for a chat
 */
function startFlow({ chatId, flowName, totalSteps = 1, companyId = 'default', sessionId = 'default', conversationId = null, flowRunId = null, nextSendAt = null, stepDelaySeconds = null }) {
  if (!chatId) return null;

  const flowData = {
    chatId,
    flowName: flowName || 'Fluxo de Resposta Rápida',
    currentStep: 0, // steps already sent
    nextSendAt: Number.isFinite(nextSendAt) ? nextSendAt : null,
    stepDelaySeconds: Number.isFinite(stepDelaySeconds) ? stepDelaySeconds : null,
    totalSteps,
    stepDescription: 'Iniciando envio...',
    startedAt: Date.now(),
    companyId,
    sessionId: sessionId || 'default',
    conversationId,
    flowRunId,
    status: 'preparing',
  };

  runningFlows.set(scopeKey(chatId, flowData), flowData);

  const io = global.io;
  if (io) {
    emitToTenant(io, companyId, 'flow:started', snapshot(flowData));
  }

  return flowData;
}

/**
 * Updates the current step of a running flow
 */
function updateFlowStep({ chatId, currentStep, stepDescription, status, nextSendAt, stepDelaySeconds, ...scope }) {
  if (!chatId && !scope.conversationId && !scope.flowRunId) return null;
  const found = findRunningEntry(chatId, scope);
  if (!found) return null;
  const flowData = found.flowData;
  if (scope.flowRunId && flowData.flowRunId !== scope.flowRunId) return null;

  flowData.currentStep = currentStep || flowData.currentStep;
  if (stepDescription) flowData.stepDescription = stepDescription;
  if (status) flowData.status = status;
  if (nextSendAt !== undefined) flowData.nextSendAt = nextSendAt;
  if (stepDelaySeconds !== undefined) flowData.stepDelaySeconds = stepDelaySeconds;
  flowData.updatedAt = Date.now();

  const io = global.io;
  if (io) {
    emitToTenant(io, flowData.companyId, 'flow:step_updated', snapshot(flowData));
  }

  return flowData;
}

/**
 * Cancels a running flow for a chat
 */
function cancelFlow(chatId, scope = {}) {
  if (!chatId && !scope.conversationId && !scope.flowRunId) return false;
  const found = findRunningEntry(chatId, scope);
  if (found) {
    const { key, flowData } = found;
    flowData.status = 'cancelled';
    runningFlows.delete(key);

    const io = global.io;
    if (io) {
      emitToTenant(io, flowData.companyId, 'flow:cancelled', { ...snapshot(flowData), status: 'cancelled' });
    }
    return true;
  }
  return false;
}

/**
 * Marks a flow as completed
 */
function finishFlow(chatId, scope = {}) {
  if (!chatId && !scope.conversationId && !scope.flowRunId) return false;
  const found = findRunningEntry(chatId, scope);
  if (found) {
    const { key, flowData } = found;
    if (scope.flowRunId && flowData.flowRunId !== scope.flowRunId) return false;
    flowData.status = 'completed';
    runningFlows.delete(key);

    const io = global.io;
    if (io) {
      emitToTenant(io, flowData.companyId, 'flow:finished', { ...snapshot(flowData), status: 'completed' });
    }
    return true;
  }
  return false;
}

/**
 * Pauses a running flow for a chat
 */
function pauseFlow(chatId, scope = {}) {
  if (!chatId && !scope.conversationId && !scope.flowRunId) return false;
  const found = findRunningEntry(chatId, scope);
  if (found) {
    const { flowData } = found;
    flowData.isPaused = true;
    flowData.status = 'paused';
    flowData.updatedAt = Date.now();

    const io = global.io;
    if (io) {
      emitToTenant(io, flowData.companyId, 'flow:paused', snapshot(flowData));
    }
    return true;
  }
  return false;
}

/**
 * Resumes a paused flow for a chat
 */
function resumeFlow(chatId, scope = {}) {
  if (!chatId && !scope.conversationId && !scope.flowRunId) return false;
  const found = findRunningEntry(chatId, scope);
  if (found) {
    const { flowData } = found;
    flowData.isPaused = false;
    flowData.status = 'running';
    flowData.updatedAt = Date.now();

    const io = global.io;
    if (io) {
      emitToTenant(io, flowData.companyId, 'flow:resumed', snapshot(flowData));
    }
    return true;
  }
  return false;
}

/**
 * Gets the current running flow for a chat
 */
function getRunningFlow(chatId, scope = {}) {
  if (!chatId && !scope.conversationId && !scope.flowRunId) return null;
  const found = findRunningEntry(chatId, scope);
  return found ? snapshot(found.flowData) : null;
}

module.exports = {
  startFlow,
  updateFlowStep,
  pauseFlow,
  resumeFlow,
  cancelFlow,
  finishFlow,
  getRunningFlow,
};
