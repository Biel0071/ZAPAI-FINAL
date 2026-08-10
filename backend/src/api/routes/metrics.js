/**
 * Metrics Routes
 * Endpoints para métricas do sistema
 */

const express = require('express');
const router = express.Router();

// GET /metrics - Métricas do sistema
router.get('/metrics', (req, res) => {
  try {
    const startTime = process.uptime();
    
    // Métricas de uptime
    const uptimeHours = Math.floor(startTime / 3600);
    const uptimeMinutes = Math.floor((startTime % 3600) / 60);
    const uptimeSeconds = Math.floor(startTime % 60);
    
    // Métricas de memória
    const memoryUsage = process.memoryUsage();
    const memoryUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const memoryTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    
    // Métricas de CPU (aproximação)
    const cpuUsage = process.cpuUsage();
    
    res.json({
      uptime: {
        seconds: Math.floor(startTime),
        formatted: `${uptimeHours}h ${uptimeMinutes}m ${uptimeSeconds}s`,
      },
      memory: {
        used: memoryUsedMB,
        total: memoryTotalMB,
        percentage: Math.round((memoryUsedMB / memoryTotalMB) * 100),
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Metrics] Error:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

// GET /health - Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

module.exports = router;
