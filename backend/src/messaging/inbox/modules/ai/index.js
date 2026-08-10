module.exports = {
  controllers: {
    ai: require('../../../../api/controllers/aiController'),
    aiConfig: require('../../../../api/controllers/aiConfigController'),
  },
  services: {
    aiResponseEngine: require('../../../../../services/aiResponseEngine'),
    aiLearningEngine: require('../../../../../services/aiLearningEngine'),
    aiDiagnosticsService: require('../../../../../services/aiDiagnosticsService'),
  },
};
