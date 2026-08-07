const { getNextFunnelStage } = require('../../salesFunnel');

class FunnelStage {
  async execute(context) {
    const start = performance.now();
    try {
      const currentStage = context.conversation?.funnel_stage || 'new_lead';
      context.funnelStage = getNextFunnelStage(
        currentStage,
        context.analysis,
        context.message
      );
    } catch (err) {
      console.error('[CRM:FunnelStage] Falha na extracao de funil', err);
    }
    context.metrics.record('funnel_time', performance.now() - start);
  }
}

module.exports = new FunnelStage();
