module.exports = {
  config: {
    ai: require('../../../infrastructure/config/ai'),
    aiToggle: require('../../../infrastructure/config/aiToggle'),
    agents: require('../../../infrastructure/config/agents'),
    businessHours: require('../../../infrastructure/config/businessHours'),
    ngrok: require('../../../infrastructure/config/ngrok'),
    promptManager: require('../../../infrastructure/config/promptManager'),
  },
  middleware: {
    requestContext: require('../../../api/middleware/requestContext'),
    rateLimiter: require('../../../api/middleware/rateLimiter'),
  },
};
