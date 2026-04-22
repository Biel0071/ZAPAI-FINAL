function createMessageWorker({ logger = console } = {}) {
  return {
    async process(job = {}) {
      logger.log('[worker:message] processing job', {
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
  createMessageWorker,
};
