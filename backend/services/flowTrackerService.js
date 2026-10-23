const runningFlows = new Map();
const { emitToTenant } = require('./realtime/tenantRooms');

function scopeKey(chatId, { companyId = 'default', sessionId = 'main', conversationId } = {}) {
  return JSON.stringify([companyId, sessionId, conversationId || chatId]);
}

function snapshot(flowData) {
  return flowData ? { ...flowData } : flowData;
}

/**
 * Starts tracking a flow execution for a chat
 */
function startFlow({ chatId, flowName, totalSteps = 1, companyId = 'default', sessionId = 'main', conversationId = null, flowRunId = null, nextSendAt = null, stepDelaySeconds = null }) {
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
    sessionId,
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
  if (!chatId) return null;
  const flowData = runningFlows.get(scopeKey(chatId, scope));
  if (!flowData) return null;
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
  if (!chatId) return false;
  const key = scopeKey(chatId, scope);
  const flowData = runningFlows.get(key);
  if (flowData) {
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
  if (!chatId) return false;
  const key = scopeKey(chatId, scope);
  const flowData = runningFlows.get(key);
  if (scope.flowRunId && flowData?.flowRunId !== scope.flowRunId) return false;
  if (flowData) {
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
  if (!chatId) return false;
  const key = scopeKey(chatId, scope);
  const flowData = runningFlows.get(key);
  if (flowData) {
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
  if (!chatId) return false;
  const key = scopeKey(chatId, scope);
  const flowData = runningFlows.get(key);
  if (flowData) {
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
  if (!chatId) return null;
  return snapshot(runningFlows.get(scopeKey(chatId, scope))) || null;
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
