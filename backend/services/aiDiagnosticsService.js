class AIDiagnosticsService {
  constructor(systemManager, bugWatcher, metricsTracker) {
    this.systemManager = systemManager;
    this.bugWatcher = bugWatcher;
    this.metricsTracker = metricsTracker;
  }

  async runAnalysis(store) {
    const status = await this.systemManager.getStatus(store);
    const bugs = this.bugWatcher.getRecentBugs?.() || [];
    const metrics = this.metricsTracker.getMetrics?.(store) || {};

    return {
      detectedBugs: bugs,
      metrics,
      systemStatus: status,
    };
  }
}

module.exports = AIDiagnosticsService;