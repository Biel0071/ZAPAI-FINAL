const { getEngineClient } = require('./AIEngineClient');

async function processEvent(event, options = {}) {
  const engine = getEngineClient(options);
  return engine.processEvent(event || {});
}

async function generateReply(payload = {}, options = {}) {
  const engine = getEngineClient(options);

  if (typeof engine.generateReply === 'function') {
    return engine.generateReply(payload || {});
  }

  const fallback = await engine.processEvent({
    type: 'incoming_message',
    conversationId: payload?.conversationId,
    message: payload?.text || '',
    text: payload?.text || '',
    metadata: payload?.metadata || {},
    context: {
      conversationId: payload?.conversationId,
      ...(payload?.metadata || {}),
    },
  });

  return fallback?.response || '';
}

module.exports = {
  generateReply,
  processEvent,
};
