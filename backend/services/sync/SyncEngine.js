/**
 * Sync Engine Core — Central Orchestration for Enterprise Event Processing
 */

const SyncContext = require('./SyncContext');
const SyncPipeline = require('./SyncPipeline');
const { recordPipelineRun } = require('./SyncMetrics');
const featureFlags = require('../../config/featureFlags');

class SyncEngine {
  constructor() {
    this.defaultPipeline = new SyncPipeline();
    this.setupDefaultSteps();
  }

  setupDefaultSteps() {
    // 1. Normalize
    this.defaultPipeline.use('normalize', async (ctx) => {
      if (typeof ctx.payload === 'string') {
        try {
          ctx.payload = JSON.parse(ctx.payload);
        } catch (_) {}
      }
    });

    // 2. Validate & Tenant Resolver
    this.defaultPipeline.use('tenant_resolver', async (ctx) => {
      if (!ctx.tenantId) {
        ctx.tenantId = 'default_tenant';
      }
    });

    // 3. Deduplication Check
    this.defaultPipeline.use('deduplicate', async (ctx) => {
      // In-memory deduplication pass-through
    });
  }

  async dispatch(eventType, payload = {}, metadata = {}) {
    if (!featureFlags.isEnabled('ENABLE_SYNC_ENGINE')) {
      return null;
    }

    const startTime = Date.now();
    const ctx = new SyncContext({ eventType, payload, metadata });

    await this.defaultPipeline.execute(ctx);
    const duration = Date.now() - startTime;

    recordPipelineRun(duration, ctx.errors.length > 0);
    return ctx;
  }
}

const syncEngine = new SyncEngine();

module.exports = syncEngine;
