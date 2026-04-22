module.exports = {
  runSmokeTests: async () => ({ skipped: true, reason: 'testRunner not available in production build' }),
  runE2ETests: async () => ({ skipped: true, reason: 'testRunner not available in production build' }),
};
