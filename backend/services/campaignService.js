const campaignEngine = require('./campaignEngine');
const campaignRuntime = require('./campaignRuntime');

function createCampaignService() {
  return {
    campaignEngine,
    campaignRuntime,
  };
}

module.exports = {
  createCampaignService,
};
