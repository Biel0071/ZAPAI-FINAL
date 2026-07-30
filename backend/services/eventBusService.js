const EventEmitter = require('events');
const featureFlags = require('../config/featureFlags');

class SystemEventBus extends EventEmitter {}

const eventBus = new SystemEventBus();
eventBus.setMaxListeners(100);

// Metric and Dead Letter Storage
const dlqStore = [];
const metrics = {
  published: 0,
  delivered: 0,
  failed: 0,
  dlqCount: 0,
  startTime: Date.now(),
};

/**
 * Publica um evento global de forma síncrona
 */
function publish(eventType, payload = {}, metadata = {}) {
  if (!featureFlags.isEnabled('ENABLE_EVENT_BUS')) {
    return null;
  }

  const eventData = {
    eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    eventType,
    timestamp: new Date().toISOString(),
    payload,
    metadata: {
      tenantId: metadata.tenantId || payload.tenantId || null,
      companyId: metadata.companyId || payload.companyId || null,
      correlationId: metadata.correlationId || payload.correlationId || null,
      ...metadata,
    },
  };

  metrics.published += 1;

  try {
    eventBus.emit(eventType, eventData);
    eventBus.emit('*', eventData);
    metrics.delivered += 1;
  } catch (err) {
    metrics.failed += 1;
    deadLetter(eventData, err);
  }

  // Transmit via Socket.io
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
 * Publica um evento assincronamente com prioridade/processamento não-bloqueante
 */
async function publishAsync(eventType, payload = {}, metadata = {}) {
  return new Promise((resolve) => {
    setImmediate(() => {
      const result = publish(eventType, payload, metadata);
      resolve(result);
    });
  });
}

/**
 * Publica lote de eventos
 */
async function publishBatch(events = []) {
  const results = [];
  for (const item of events) {
    const res = await publishAsync(item.eventType, item.payload, item.metadata);
    results.push(res);
  }
  return results;
}

/**
 * Inscreve um ouvinte para um tipo de evento
 */
function subscribe(eventType, handler) {
  eventBus.on(eventType, handler);
  return () => eventBus.off(eventType, handler);
}

function unsubscribe(eventType, handler) {
  eventBus.off(eventType, handler);
}

/**
 * Adiciona ao Dead Letter Queue em caso de falha
 */
function deadLetter(eventData, error) {
  if (!featureFlags.isEnabled('ENABLE_DLQ')) return;

  const dlqEntry = {
    ...eventData,
    failedAt: new Date().toISOString(),
    error: error?.message || String(error),
  };

  dlqStore.push(dlqEntry);
  if (dlqStore.length > 500) dlqStore.shift(); // Limite em memória

  metrics.dlqCount = dlqStore.length;
  console.error('[EVENT_BUS DLQ] Evento encaminhado para DLQ:', dlqEntry.eventId, error?.message);
}

function getDLQ() {
  return [...dlqStore];
}

function clearDLQ() {
  dlqStore.length = 0;
  metrics.dlqCount = 0;
}

function getEventBusMetrics() {
  return {
    ...metrics,
    activeListeners: eventBus.eventNames().length,
    uptimeSeconds: Math.floor((Date.now() - metrics.startTime) / 1000),
  };
}

module.exports = {
  clearDLQ,
  deadLetter,
  eventBus,
  getDLQ,
  getEventBusMetrics,
  publish,
  publishAsync,
  publishBatch,
  publishEvent: publish,
  subscribe,
  subscribeEvent: subscribe,
  unsubscribe,
};
