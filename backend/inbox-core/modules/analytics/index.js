module.exports = {
  controller: require('../../../controllers/analyticsController'),
  services: {
    analytics: require('../../../services/analyticsService'),
    metrics: require('../../../services/metricsTracker'),
  },
};
