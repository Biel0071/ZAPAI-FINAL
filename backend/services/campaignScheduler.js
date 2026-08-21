const cron = require('node-cron');
const campaignRepository = require('../src/data/repositories/campaignRepository');
const campaignDispatchEngine = require('./campaignDispatchEngine');
const { backendLog } = require('./logger');

let schedulerTask = null;

function startCampaignScheduler(io) {
  if (schedulerTask) {
    return;
  }
  
  backendLog('info', 'campaignScheduler:started', { message: 'Campaign scheduler active' });

  schedulerTask = cron.schedule('* * * * *', async () => {
    try {
      // Find campaigns scheduled for now or past
      const scheduledCampaigns = await campaignRepository.getScheduledCampaignsToRun();
      
      for (const campaign of scheduledCampaigns) {
        backendLog('info', 'campaignScheduler:trigger', { campaignId: campaign.id, name: campaign.name });
        
        try {
          await campaignDispatchEngine.startCampaign(campaign.id, campaign.companyId || 'default', io);
        } catch (dispatchErr) {
          backendLog('error', 'campaignScheduler:dispatch_error', { 
            campaignId: campaign.id, 
            error: dispatchErr.message 
          });
          // Update status to failed so it doesn't loop
          await campaignRepository.updateCampaign(campaign.id, { status: 'failed' }, campaign.companyId || 'default');
        }
      }
    } catch (err) {
      backendLog('error', 'campaignScheduler:loop_error', { error: err.message });
    }
  });
}

function stopCampaignScheduler() {
  if (schedulerTask) {
    schedulerTask.stop();
    schedulerTask = null;
  }
}

module.exports = {
  startCampaignScheduler,
  stopCampaignScheduler,
};
