const routes = require('../../../api/routes/analytics');
const controller = require('../../../api/controllers/analyticsController');
const analyticsService = require('../../../../services/analyticsService');
const metricsTracker = require('../../../../services/metricsTracker');

module.exports = {
  name: 'analytics',
  routes,
  controller,
  services: {
    analyticsService,
    metricsTracker,
  },
};
