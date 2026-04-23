const { evaluateCampaign } = require('./campaignEngine');

function buildCampaignSnapshot(conversations = []) {
  const campaigns = conversations
    .map((conversation) => {
      const campaign = evaluateCampaign(conversation);

      if (!campaign) {
        return null;
      }

      return {
        campaign: campaign.campaign,
        conversationId: conversation.id,
        phone: conversation.phone,
        target: campaign.target,
      };
    })
    .filter(Boolean);

  const summary = campaigns.reduce((accumulator, item) => {
    accumulator[item.campaign] = (accumulator[item.campaign] || 0) + 1;
    return accumulator;
  }, {});

  return {
    campaigns,
    generatedAt: new Date().toISOString(),
    summary,
  };
}

function emitCampaignSnapshot(store, snapshot) {
  const io = store?.io || global.io;

  if (!io) {
    return;
  }

  io.emit('campaigns.updated', snapshot);
}

function startCampaignRuntime(store, options = {}) {
  const intervalMs = Number(options.intervalMs) || 300000;

  const run = () => {
    const snapshot = buildCampaignSnapshot(store?.conversations || []);
    store.campaignSnapshot = snapshot;
    emitCampaignSnapshot(store, snapshot);
  };

  run();
  const timer = setInterval(run, intervalMs);

  return {
    stop() {
      clearInterval(timer);
    },
  };
}

module.exports = {
  buildCampaignSnapshot,
  startCampaignRuntime,
};
