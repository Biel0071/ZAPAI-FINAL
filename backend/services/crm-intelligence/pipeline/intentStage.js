const { analyzeLeadIntent, buildLeadAlgorithm } = require('../../leadAnalyzer');

class IntentStage {
  async execute(context) {
    const start = performance.now();
    try {
      const analysis = analyzeLeadIntent(context.message, context.leadHistory);
      const leadAlgorithm = buildLeadAlgorithm(
        context.message,
        context.leadHistory,
        {
          ...(context.conversation || {}),
          name: context.contact?.name || context.conversation?.name || context.conversation?.lead_name,
        }
      );
      context.analysis = {
        ...context.analysis,
        ...analysis,
        leadAlgorithm,
      };
      context.leadAlgorithm = leadAlgorithm;
    } catch (err) {
      console.error('[CRM:IntentStage] Falha na extracao de intencao', err);
    }
    context.metrics.record('intent_time', performance.now() - start);
  }
}

module.exports = new IntentStage();
