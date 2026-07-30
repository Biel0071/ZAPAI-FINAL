/**
 * Sync Context — Immutable Context Wrapper for Pipeline Execution
 */

class SyncContext {
  constructor({ eventType, payload = {}, metadata = {} }) {
    this.eventId = `sync_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    this.eventType = eventType;
    this.payload = payload;
    this.tenantId = metadata.tenantId || payload.tenantId || payload.companyId || 'default';
    this.companyId = metadata.companyId || payload.companyId || this.tenantId;
    this.correlationId = metadata.correlationId || payload.correlationId || `corr_${Date.now()}`;
    this.createdAt = new Date().toISOString();
    this.stages = [];
    this.errors = [];
    this.cancelled = false;
  }

  addStage(stageName, data = {}) {
    this.stages.push({
      stage: stageName,
      timestamp: new Date().toISOString(),
      data,
    });
  }

  addError(stageName, error) {
    this.errors.push({
      stage: stageName,
      error: error?.message || String(error),
      timestamp: new Date().toISOString(),
    });
  }

  cancel(reason = 'Cancelled by pipeline step') {
    this.cancelled = true;
    this.addStage('cancel', { reason });
  }
}

module.exports = SyncContext;
