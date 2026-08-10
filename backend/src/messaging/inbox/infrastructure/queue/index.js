module.exports = {
  workers: {
    campaignWorker: require('../../../../infrastructure/workers/campaignWorker'),
    messageWorker: require('../../../../infrastructure/workers/messageWorker'),
  },
};
