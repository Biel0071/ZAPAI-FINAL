function createCampaignWorker({ logger = console } = {}) {
  return {
    async process(job = {}) {
      logger.log('[worker:campaign] processing job', {
        type: job.type || 'unknown',
      });

      return {
        ok: true,
        processedAt: new Date().toISOString(),
      };
    },
  };
}

module.exports = {
  createCampaignWorker,
};
