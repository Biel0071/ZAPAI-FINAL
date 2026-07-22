const runningFlows = new Map();

/**
 * Starts tracking a flow execution for a chat
 */
function startFlow({ chatId, flowName, totalSteps = 1, companyId = 'default' }) {
  if (!chatId) return null;

  const flowData = {
    chatId,
    flowName: flowName || 'Fluxo de Resposta Rápida',
    currentStep: 1,
    totalSteps,
    stepDescription: 'Iniciando envio...',
    startedAt: Date.now(),
    companyId,
    status: 'running',
  };

  runningFlows.set(chatId, flowData);

  const io = global.io;
  if (io) {
    io.emit('flow:started', flowData);
    io.to(`chat:${chatId}`).emit('flow:started', flowData);
  }

  return flowData;
}

/**
 * Updates the current step of a running flow
 */
function updateFlowStep({ chatId, currentStep, stepDescription }) {
  if (!chatId) return null;
  const flowData = runningFlows.get(chatId);
  if (!flowData) return null;

  flowData.currentStep = currentStep || flowData.currentStep;
  if (stepDescription) flowData.stepDescription = stepDescription;
  flowData.updatedAt = Date.now();

  const io = global.io;
  if (io) {
    io.emit('flow:step_updated', flowData);
    io.to(`chat:${chatId}`).emit('flow:step_updated', flowData);
  }

  return flowData;
}

/**
 * Cancels a running flow for a chat
 */
function cancelFlow(chatId) {
  if (!chatId) return false;
  const flowData = runningFlows.get(chatId);
  if (flowData) {
    flowData.status = 'cancelled';
    runningFlows.delete(chatId);

    const io = global.io;
    if (io) {
      io.emit('flow:cancelled', { chatId, flowName: flowData.flowName });
      io.to(`chat:${chatId}`).emit('flow:cancelled', { chatId, flowName: flowData.flowName });
    }
    return true;
  }
  return false;
}

/**
 * Marks a flow as completed
 */
function finishFlow(chatId) {
  if (!chatId) return false;
  const flowData = runningFlows.get(chatId);
  if (flowData) {
    flowData.status = 'completed';
    runningFlows.delete(chatId);

    const io = global.io;
    if (io) {
      io.emit('flow:finished', { chatId, flowName: flowData.flowName });
      io.to(`chat:${chatId}`).emit('flow:finished', { chatId, flowName: flowData.flowName });
    }
    return true;
  }
  return false;
}

/**
 * Gets the current running flow for a chat
 */
function getRunningFlow(chatId) {
  if (!chatId) return null;
  return runningFlows.get(chatId) || null;
}

module.exports = {
  startFlow,
  updateFlowStep,
  cancelFlow,
  finishFlow,
  getRunningFlow,
};
