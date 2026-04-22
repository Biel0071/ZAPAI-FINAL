module.exports = {
  controller: require('../../../controllers/automationController'),
  services: {
    engine: require('../../../services/campaignEngine'),
    runtime: require('../../../services/campaignRuntime'),
    service: require('../../../services/campaignService'),
  },
};
