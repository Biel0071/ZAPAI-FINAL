module.exports = {
  controller: require('../../../../api/controllers/analyticsController'),
  services: {
    analytics: require('../../../../../services/analyticsService'),
    metrics: require('../../../../../services/metricsTracker'),
  },
};
