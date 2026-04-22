module.exports = {
  controllers: {
    ai: require('../../../controllers/aiController'),
    aiConfig: require('../../../controllers/aiConfigController'),
  },
  services: {
    aiResponseEngine: require('../../../services/aiResponseEngine'),
    aiLearningEngine: require('../../../services/aiLearningEngine'),
    aiDiagnosticsService: require('../../../services/aiDiagnosticsService'),
  },
};
