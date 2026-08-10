/**
 * Domain Events — System Domain
 */

const SYSTEM_EVENTS = {
  HEALTHY: 'system.healthy',
  DEGRADED: 'system.degraded',
  ALERT: 'system.alert',
  METRICS_AGGREGATED: 'system.metrics_aggregated',
};

module.exports = {
  SYSTEM_EVENTS,
};
