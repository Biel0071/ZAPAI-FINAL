/**
 * Sync Pipeline — Sequential execution of sync stages:
 * Normalize ➔ Validate ➔ Tenant ➔ Dedupe ➔ Retry ➔ Persist ➔ Publish
 */

const correlationTracker = require('../correlationTracker');
const eventBusService = require('../eventBusService');

class SyncPipeline {
  constructor() {
    this.steps = [];
  }

  use(stepName, fn) {
    this.steps.push({ name: stepName, execute: fn });
    return this;
  }

  async execute(context) {
    correlationTracker.startTrace(context.correlationId, {
      tenantId: context.tenantId,
      eventType: context.eventType,
    });

    for (const step of this.steps) {
      if (context.cancelled) break;

      try {
        context.addStage(step.name);
        correlationTracker.addTraceEvent(context.correlationId, step.name, {
          eventType: context.eventType,
        });

        await step.execute(context);
      } catch (err) {
        console.error(`[SYNC PIPELINE ERROR] Step ${step.name} falhou:`, err.message);
        context.addError(step.name, err);
        correlationTracker.addTraceEvent(context.correlationId, `${step.name}_error`, {
          error: err.message,
        });
      }
    }

    // Publish to Event Bus if not cancelled
    if (!context.cancelled) {
      eventBusService.publish(context.eventType, context.payload, {
        tenantId: context.tenantId,
        companyId: context.companyId,
        correlationId: context.correlationId,
      });
    }

    correlationTracker.endTrace(context.correlationId, {
      cancelled: context.cancelled,
      errorsCount: context.errors.length,
    });

    return context;
  }
}

module.exports = SyncPipeline;
