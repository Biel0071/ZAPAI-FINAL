/**
 * Per-tenant WhatsApp session state.
 *
 * Replaces the single `global.whatsappSession` singleton with a tenant-indexed
 * map. To preserve backwards compatibility with existing callers that still
 * read `global.whatsappSession` directly, the default tenant entry is mirrored
 * onto `global.whatsappSession` on every update.
 *
 * Migration path:
 *   1. New code calls getWhatsappSession(tenantId) / setWhatsappSession(...).
 *   2. Legacy code keeps reading global.whatsappSession for the default tenant.
 *   3. Once all legacy reads are migrated, the global alias can be removed.
 */

const DEFAULT_TENANT = String(process.env.DEFAULT_COMPANY_ID || 'default').trim() || 'default';

const INITIAL_STATE = Object.freeze({
  connected: false,
  status: 'DISCONNECTED',
});

const tenantStates = new Map();

function normalizeTenantId(value) {
  const trimmed = String(value || '').trim();
  return trimmed || DEFAULT_TENANT;
}

function syncGlobalAlias() {
  const defaultState = tenantStates.get(DEFAULT_TENANT) || { ...INITIAL_STATE };
  // Mutate the same object reference so legacy consumers keep seeing updates.
  if (!global.whatsappSession || typeof global.whatsappSession !== 'object') {
    global.whatsappSession = { ...defaultState };
  } else {
    Object.assign(global.whatsappSession, defaultState);
  }
}

function getWhatsappSession(tenantId) {
  const key = normalizeTenantId(tenantId);

  if (!tenantStates.has(key)) {
    tenantStates.set(key, { ...INITIAL_STATE });
    if (key === DEFAULT_TENANT) {
      syncGlobalAlias();
    }
  }

  return tenantStates.get(key);
}

function setWhatsappSession(tenantId, patch = {}) {
  const key = normalizeTenantId(tenantId);
  const current = getWhatsappSession(key);
  const next = { ...current, ...patch };
  tenantStates.set(key, next);

  if (key === DEFAULT_TENANT) {
    syncGlobalAlias();
  }

  return next;
}

function resetWhatsappSession(tenantId) {
  const key = normalizeTenantId(tenantId);
  tenantStates.set(key, { ...INITIAL_STATE });
  if (key === DEFAULT_TENANT) {
    syncGlobalAlias();
  }
}

function listTenantSessionStates() {
  return Array.from(tenantStates.entries()).map(([tenantId, state]) => ({
    tenantId,
    ...state,
  }));
}

// Initialize default tenant immediately so global.whatsappSession is ready
// for legacy readers at require-time.
getWhatsappSession(DEFAULT_TENANT);

module.exports = {
  DEFAULT_TENANT,
  getWhatsappSession,
  listTenantSessionStates,
  normalizeTenantId,
  resetWhatsappSession,
  setWhatsappSession,
};
