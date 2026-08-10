const conversationRepository = require('../../../src/data/repositories/conversationRepository');

class PersistStage {
  async execute(context) {
    const start = performance.now();
    try {
      const updatePayload = {
        funnel_stage: context.funnelStage,
        lead_confidence: context.analysis.confidence,
        lead_intent: context.analysis.intent,
        lead_temperature: context.analysis.lead_temperature,
        next_action: context.analysis.next_action,
        summary: context.summary,
        tags: context.tags,
      };

      // 1 UPDATE instead of multiple
      context.crmState = await conversationRepository.updateConversationState(
        context.conversationId, 
        updatePayload
      );
      
      console.log(`[CRM_DB_UPDATED] Conversa ${context.conversationId} atualizada.`);
    } catch (err) {
      console.error('[CRM:PersistStage] Falha ao persistir CRM state', err);
    }
    context.metrics.record('db_update_time', performance.now() - start);
  }
}

module.exports = new PersistStage();
