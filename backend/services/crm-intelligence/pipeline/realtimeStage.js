const eventBus = require('../events/EventBus');

class RealtimeStage {
  async execute(context) {
    const start = performance.now();
    try {
      // We publish to the internal EventBus, completely decoupling 
      // the CRM Engine from Socket.IO or any specific frontend.
      eventBus.publish('crm.updated', context);
      
      console.log(`[CRM_SOCKET_SENT] Evento emitido para conversa ${context.conversationId}`);
    } catch (err) {
      console.error('[CRM:RealtimeStage] Falha ao emitir eventos', err);
    }
    context.metrics.record('realtime_emit_time', performance.now() - start);
  }
}

module.exports = new RealtimeStage();
