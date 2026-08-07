class CRMMetrics {
  constructor() {
    this.metrics = {
      history_load_time: 0,
      intent_time: 0,
      temperature_time: 0,
      summary_time: 0,
      funnel_time: 0,
      db_update_time: 0,
      total_time: 0,
      cache_hit: 0,
      cache_miss: 0,
    };
  }

  record(metricName, durationMs) {
    if (this.metrics[metricName] !== undefined) {
      this.metrics[metricName] = durationMs;
    }
  }

  increment(metricName) {
    if (this.metrics[metricName] !== undefined) {
      this.metrics[metricName] += 1;
    }
  }

  logSummary(contextId) {
    console.log(`[CRMMetrics - ${contextId}]`, JSON.stringify(this.metrics));
  }
}

module.exports = CRMMetrics;
