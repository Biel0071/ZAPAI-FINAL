const automationRoutes = require('../../../api/routes/automation');
const automationController = require('../../../api/controllers/automationController');
const campaignEngine = require('../../../../services/campaignEngine');
const campaignRuntime = require('../../../../services/campaignRuntime');

module.exports = {
  name: 'campaigns',
  routes: automationRoutes,
  controller: automationController,
  services: {
    campaignEngine,
    campaignRuntime,
  },
};
