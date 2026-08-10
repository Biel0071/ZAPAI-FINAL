const routes = require('../../../api/routes/automation');
const controller = require('../../../api/controllers/automationController');
const automationService = require('../../../../services/automationService');
const microtaskRunner = require('../../../../services/microtaskRunner');

module.exports = {
  name: 'automation',
  routes,
  controller,
  services: {
    automationService,
    microtaskRunner,
  },
};
