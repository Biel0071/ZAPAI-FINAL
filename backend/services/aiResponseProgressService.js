const { emitToTenant } = require('./realtime/tenantRooms');

const ACTIVE_STATUSES = new Set(['analyzing', 'generating', 'queued', 'waiting', 'typing', 'sending']);
const TERMINAL_STATUSES = new Set(['completed', 'cancelled', 'disabled', 'failed', 'no_agent']);

function normalizeStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  return ACTIVE_STATUSES.has(status) || TERMINAL_STATUSES.has(status) ? status : 'analyzing';
}

function emitAIResponseProgress(io, payload = {}) {
  const conversationId = String(payload.conversationId || '').trim();
  if (!io || !conversationId) return null;

  const companyId = String(payload.companyId || process.env.DEFAULT_COMPANY_ID || 'default').trim() || 'default';
  const status = normalizeStatus(payload.status);
  const startedAt = String(payload.startedAt || new Date().toISOString());
  const estimatedMs = Math.max(0, Number(payload.estimatedMs) || 0);

  const event = {
    companyId,
    conversationId,
    phone: payload.phone ? String(payload.phone) : null,
    sessionId: payload.sessionId ? String(payload.sessionId) : null,
    agentName: payload.agentName ? String(payload.agentName) : null,
    status,
    stage: String(payload.stage || status),
    message: String(payload.message || ''),
    startedAt,
    estimatedMs,
    estimatedCompletionAt: estimatedMs > 0
      ? new Date(Date.now() + estimatedMs).toISOString()
      : null,
    updatedAt: new Date().toISOString(),
  };

  emitToTenant(io, companyId, 'ai:progress', event);
  return event;
}

module.exports = {
  ACTIVE_STATUSES,
  TERMINAL_STATUSES,
  emitAIResponseProgress,
};
