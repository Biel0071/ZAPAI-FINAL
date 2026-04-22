const automationRoutes = require('../../routes/automation');
const automationController = require('../../controllers/automationController');
const campaignEngine = require('../../services/campaignEngine');
const campaignRuntime = require('../../services/campaignRuntime');

module.exports = {
  name: 'campaigns',
  routes: automationRoutes,
  controller: automationController,
  services: {
    campaignEngine,
    campaignRuntime,
  },
};
