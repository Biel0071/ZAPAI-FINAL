/**
 * Best-effort session persistence wrappers.
 * Extracted from whatsappService.legacy.js (Phase 2a).
 *
 * These functions swallow failures from the session repository and emit a
 * warning — the intent is that an unavailable DB must not break the Baileys
 * lifecycle. No module-scoped mutable state.
 */

const sessionRepository = require('../../../src/data/repositories/sessionRepository');
const { whatsappLog } = require('../../logger');

const persistenceHealth = {
  consecutiveFailures: 0,
  degraded: false,
  lastError: null,
  lastFailureAt: null,
  lastOperation: null,
  lastSuccessAt: null,
};

function markPersistenceSuccess(operation) {
  persistenceHealth.consecutiveFailures = 0;
  persistenceHealth.degraded = false;
  persistenceHealth.lastError = null;
  persistenceHealth.lastOperation = operation;
  persistenceHealth.lastSuccessAt = new Date().toISOString();
}

function markPersistenceFailure(sessionId, operation, error) {
  persistenceHealth.consecutiveFailures += 1;
  persistenceHealth.degraded = true;
  persistenceHealth.lastError = error?.message || String(error);
  persistenceHealth.lastFailureAt = new Date().toISOString();
  persistenceHealth.lastOperation = operation;

  whatsappLog('warn', 'persistence_degraded', `Session ${sessionId} persistence degraded`, {
    consecutiveFailures: persistenceHealth.consecutiveFailures,
    error: persistenceHealth.lastError,
    operation,
    sessionId,
  });
}

function getPersistenceHealth() {
  return {
    ...persistenceHealth,
  };
}

async function safeCreateSessionRecord(sessionId, sessionName, fallbackCompanyId = null) {
  try {
    const { query } = require('../../../src/infrastructure/config/database');
    let existing;
    try {
      existing = await query('SELECT company_id FROM sessions WHERE session_id=$1', [sessionId]);
    } catch (_dbErr) {
      // database might be briefly unavailable
    }
    if (existing?.rows?.[0]) {
      markPersistenceSuccess('create_session_record');
      return;
    }
    const targetCompanyId = fallbackCompanyId || process.env.DEFAULT_COMPANY_ID || 'default';
    await sessionRepository.createSession({
      companyId: targetCompanyId,
      sessionId,
      sessionName: sessionName || sessionId,
      status: 'connecting',
    });
    markPersistenceSuccess('create_session_record');
  } catch (error) {
    markPersistenceFailure(sessionId, 'create_session_record', error);
  }
}

async function safeUpdateSessionStatus(sessionId, status, phone, sessionName, whatsappName = null, fallbackCompanyId = null) {
  try {
    const { query } = require('../../../src/infrastructure/config/database');
    let companyId = fallbackCompanyId;
    if (!companyId) {
      try {
        const existing = await query('SELECT company_id FROM sessions WHERE session_id=$1', [sessionId]);
        companyId = existing?.rows?.[0]?.company_id;
      } catch (_dbErr) {
        // database might be briefly unavailable
      }
    }
    const targetCompanyId = companyId || process.env.DEFAULT_COMPANY_ID || 'default';
    await sessionRepository.updateSessionStatus(
      sessionId,
      status,
      phone,
      targetCompanyId,
      sessionName,
      whatsappName
    );
    markPersistenceSuccess('update_session_status');
  } catch (error) {
    markPersistenceFailure(sessionId, 'update_session_status', error);
  }
}

module.exports = {
  getPersistenceHealth,
  safeCreateSessionRecord,
  safeUpdateSessionStatus,
};
