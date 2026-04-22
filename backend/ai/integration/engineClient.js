const { getEngineClient } = require('../../backend/ai/AIEngineClient');

async function processIncomingMessage(event, options = {}) {
  const engine = getEngineClient(options);
  return engine.processEvent(event || {});
}

module.exports = {
  getEngineClient,
  processIncomingMessage,
};
