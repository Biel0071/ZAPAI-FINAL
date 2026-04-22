module.exports = {
  config: {
    ai: require('../../config/ai'),
    aiToggle: require('../../config/aiToggle'),
    agents: require('../../config/agents'),
    businessHours: require('../../config/businessHours'),
    ngrok: require('../../config/ngrok'),
    promptManager: require('../../config/promptManager'),
  },
  middleware: {
    requestContext: require('../../middleware/requestContext'),
    rateLimiter: require('../../middleware/rateLimiter'),
  },
};
