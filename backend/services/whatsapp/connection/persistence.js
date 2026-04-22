/**
 * Best-effort session persistence wrappers.
 * Extracted from whatsappService.legacy.js (Phase 2a).
 *
 * These functions swallow failures from the session repository and emit a
 * warning — the intent is that an unavailable DB must not break the Baileys
 * lifecycle. No module-scoped mutable state.
 */

const sessionRepository = require('../../../repositories/sessionRepository');

async function safeCreateSessionRecord(sessionId, sessionName) {
  try {
    await sessionRepository.createSession({
      phoneNumber: null,
      sessionId,
      sessionName,
      status: 'connecting',
    });
  } catch (error) {
    console.warn(
      `[DB] Session ${sessionId} persistence unavailable:`,
      error?.message || error
    );
  }
}

async function safeUpdateSessionStatus(sessionId, status, phone, sessionName) {
  try {
    await sessionRepository.updateSessionStatus(
      sessionId,
      status,
      phone,
      undefined,
      sessionName
    );
  } catch (error) {
    console.warn(
      `[DB] Session ${sessionId} status sync failed:`,
      error?.message || error
    );
  }
}

module.exports = {
  safeCreateSessionRecord,
  safeUpdateSessionStatus,
};
