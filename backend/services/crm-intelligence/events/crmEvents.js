const eventBus = require('./EventBus');

/**
 * Registra os listeners que convertem os eventos internos do CRM 
 * em eventos do Socket.IO (emitidos para o frontend).
 */
eventBus.on('crm.updated', (context) => {
  try {
    const io = context.store?.io || global.io;
    if (!io) return;

    const { conversationId, contact, analysis, funnelStage, tags } = context;
    const phone = contact.phone;

      // 1. Atualizar Conversa
      if (context.crmState) {
        io.emit('conversation_updated', context.crmState);
      }

      // 2. Atualizar Lead
      io.emit('lead_updated', {
        conversationId,
        phone,
        intent: analysis?.intent,
        lead_temperature: analysis?.lead_temperature,
        next_action: analysis?.next_action,
        tags: tags || []
      });

      // 3. Atualizar Funil
      if (funnelStage) {
        io.emit('funnel_updated', {
          conversationId,
          phone,
          funnel_stage: funnelStage
        });
      }

    } catch (err) {
      console.error('[CRMEvents] Falha ao emitir eventos de socket:', err.message);
    }
  });

module.exports = { initializeCRMEvents };
