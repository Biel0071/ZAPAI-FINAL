const routes = require('../../routes/analytics');
const controller = require('../../controllers/analyticsController');
const analyticsService = require('../../services/analyticsService');
const metricsTracker = require('../../services/metricsTracker');

module.exports = {
  name: 'analytics',
  routes,
  controller,
  services: {
    analyticsService,
    metricsTracker,
  },
};
