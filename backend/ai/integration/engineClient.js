const { getEngineClient } = require('../../inbox-core/ai/AIEngineClient');

async function processIncomingMessage(event, options = {}) {
  const engine = getEngineClient(options);
  return engine.processEvent(event || {});
}

module.exports = {
  getEngineClient,
  processIncomingMessage,
};
