const routes = require('../../routes/automation');
const controller = require('../../controllers/automationController');
const automationService = require('../../services/automationService');
const microtaskRunner = require('../../services/microtaskRunner');

module.exports = {
  name: 'automation',
  routes,
  controller,
  services: {
    automationService,
    microtaskRunner,
  },
};
