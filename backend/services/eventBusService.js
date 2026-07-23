const EventEmitter = require('events');

class SystemEventBus extends EventEmitter {}

const eventBus = new SystemEventBus();

// Limite elevado de ouvintes simultâneos para monorepo enterprise
eventBus.setMaxListeners(100);

/**
 * Publica um evento global do sistema e propaga para o WebSocket (se disponível)
 */
function publishEvent(eventType, payload = {}) {
  const eventData = {
    eventType,
    timestamp: new Date().toISOString(),
    payload,
  };

  // Emite localmente no Node.js
  eventBus.emit(eventType, eventData);
  eventBus.emit('*', eventData);

  // Propaga via Socket.io global se configurado
  if (global.io) {
    try {
      global.io.emit('system_event', eventData);
      global.io.emit(eventType, payload);
    } catch (err) {
      console.warn('[EVENT_BUS] Erro ao transmitir evento via Socket.io:', err.message);
    }
  }

  return eventData;
}

/**
 * Inscreve um ouvinte para um tipo específico de evento
 */
function subscribeEvent(eventType, handler) {
  eventBus.on(eventType, handler);
  return () => eventBus.off(eventType, handler);
}

module.exports = {
  eventBus,
  publishEvent,
  subscribeEvent,
};
