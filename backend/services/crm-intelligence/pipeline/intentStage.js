const { analyzeLeadIntent } = require('../../leadAnalyzer');

class IntentStage {
  async execute(context) {
    const start = performance.now();
    try {
      const analysis = analyzeLeadIntent(context.message, context.leadHistory);
      context.analysis = {
          ...context.analysis,
          ...analysis
      };
    } catch (err) {
      console.error('[CRM:IntentStage] Falha na extracao de intencao', err);
    }
    context.metrics.record('intent_time', performance.now() - start);
  }
}

module.exports = new IntentStage();
