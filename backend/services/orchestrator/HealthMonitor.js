'use strict';

/**
 * HealthMonitor — ZAPFLOW Unified WhatsApp Orchestrator
 * Monitoramento em tempo real de disponibilidade, consumo de CPU/RAM,
 * latência média, taxa de falhas e sessões ativas por motor.
 */

const os = require('os');
const webBridgeManager = require('./WebBridgeManager');
const transportRegistry = require('./TransportRegistry');

class HealthMonitor {
  constructor() {
    this.metrics = {
      messagesProcessed: 0,
      commercialOperations: 0,
      failuresCount: 0,
      latencies: [],
      startTime: Date.now(),
    };
  }

  recordOperation(durationMs, isCommercial = false, isSuccess = true) {
    this.metrics.messagesProcessed += 1;
    if (isCommercial) this.metrics.commercialOperations += 1;
    if (!isSuccess) this.metrics.failuresCount += 1;

    this.metrics.latencies.push(durationMs);
    if (this.metrics.latencies.length > 500) {
      this.metrics.latencies.shift();
    }
  }

  getSnapshot() {
    const memUsage = process.memoryUsage();
    const uptimeSeconds = Math.floor((Date.now() - this.metrics.startTime) / 1000);
    const avgLatency = this.metrics.latencies.length > 0
      ? Math.round(this.metrics.latencies.reduce((a, b) => a + b, 0) / this.metrics.latencies.length)
      : 0;

    const failureRate = this.metrics.messagesProcessed > 0
      ? Number(((this.metrics.failuresCount / this.metrics.messagesProcessed) * 100).toFixed(2))
      : 0;

    const cpus = os.cpus();
    const cpuLoad = os.loadavg();

    // Contagem de sessões ativas
    let activeBaileysCount = 0;
    let activeWebBridgeCount = 0;
    for (const [, transports] of transportRegistry.transports.entries()) {
      for (const [, t] of transports.entries()) {
        if (t.engine === 'BAILEYS' && t.status === 'connected') activeBaileysCount++;
        if (t.engine === 'WHATSAPP_WEB_BRIDGE' && t.status === 'ready') activeWebBridgeCount++;
      }
    }

    return {
      timestamp: new Date().toISOString(),
      uptimeSeconds,
      system: {
        cpuCores: cpus.length,
        loadAverage: cpuLoad,
        memoryRssMb: Math.round(memUsage.rss / (1024 * 1024)),
        heapUsedMb: Math.round(memUsage.heapUsed / (1024 * 1024)),
        heapTotalMb: Math.round(memUsage.heapTotal / (1024 * 1024)),
      },
      engines: {
        activeBaileysSessions: activeBaileysCount,
        activeWebBridgeSessions: activeWebBridgeCount,
        webBridgeAvailable: webBridgeManager.isPlaywrightAvailable,
      },
      performance: {
        totalOperations: this.metrics.messagesProcessed,
        commercialOperations: this.metrics.commercialOperations,
        failuresCount: this.metrics.failuresCount,
        failureRatePercent: failureRate,
        averageLatencyMs: avgLatency,
      },
      status: failureRate > 15 ? 'degraded' : 'healthy',
    };
  }
}

module.exports = new HealthMonitor();
