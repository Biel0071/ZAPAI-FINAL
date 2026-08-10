module.exports = {
  controller: require('../../../../api/controllers/automationController'),
  services: {
    engine: require('../../../../../services/campaignEngine'),
    runtime: require('../../../../../services/campaignRuntime'),
    service: require('../../../../../services/campaignService'),
  },
};
