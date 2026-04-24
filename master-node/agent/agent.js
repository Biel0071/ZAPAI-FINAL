/**
 * ============================================================================
 * MASTER NODE AGENT
 * ============================================================================
 * 
 * Agent local instalado em cada VPS para:
 * - Enviar heartbeat a cada 30 segundos
 * - Receber e executar comandos remotos
 * - Enviar métricas em tempo real
 * - Enviar logs de erros
 * - Monitorar sessões WhatsApp
 * 
 * Zero mock. Tudo produção real.
 * ============================================================================
 */

const axios = require('axios');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Configuration
const config = {
  masterApiUrl: process.env.MASTER_API_URL || 'http://localhost:5000/api',
  nodeId: process.env.NODE_ID,
  token: process.env.NODE_TOKEN,
  heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL) || 30000, // 30 segundos
  localApiPort: process.env.LOCAL_API_PORT || 4025,
};

// State
let isRunning = true;
let uptimeStart = Date.now();

// ============================================================================
// SYSTEM METRICS
// ============================================================================

async function getCpuUsage() {
  const cpus = os.cpus();
  const startMeasure = cpus.reduce((acc, cpu) => {
    acc.total += Object.values(cpu.times).reduce((a, b) => a + b);
    acc.idle += cpu.times.idle;
    return acc;
  }, { total: 0, idle: 0 });

  return new Promise((resolve) => {
    setTimeout(() => {
      const endMeasure = cpus.reduce((acc, cpu) => {
        acc.total += Object.values(cpu.times).reduce((a, b) => a + b);
        acc.idle += cpu.times.idle;
        return acc;
      }, { total: 0, idle: 0 });

      const idleDiff = endMeasure.idle - startMeasure.idle;
      const totalDiff = endMeasure.total - startMeasure.total;
      const usage = 100 - (100 * (idleDiff / totalDiff));
      resolve(usage.toFixed(2));
    }, 100);
  });
}

function getMemoryUsage() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  return ((usedMem / totalMem) * 100).toFixed(2);
}

async function getDiskUsage() {
  try {
    const { stdout } = await execAsync('df -h /');
    const lines = stdout.split('\n');
    const data = lines[1].split(/\s+/);
    const usedPercent = data[4].replace('%', '');
    return parseFloat(usedPercent).toFixed(2);
  } catch (error) {
    return null;
  }
}

function getUptimeSeconds() {
  return Math.floor((Date.now() - uptimeStart) / 1000);
}

// ============================================================================
// WHATSAPP SESSIONS
// ============================================================================

async function getWhatsAppSessions() {
  try {
    const response = await axios.get(`http://localhost:${config.localApiPort}/api/sessions`, {
      timeout: 5000,
    });
    
    if (response.data && response.data.data) {
      const sessions = response.data.data;
      return {
        active_sessions: sessions.filter(s => s.connected).length,
        total_sessions: sessions.length,
        whatsapp_connected: sessions.some(s => s.connected),
      };
    }
  } catch (error) {
    // Local API might not be available
    return {
      active_sessions: 0,
      total_sessions: 0,
      whatsapp_connected: false,
    };
  }
}

async function getMessagesToday() {
  try {
    const response = await axios.get(`http://localhost:${config.localApiPort}/api/metrics`, {
      timeout: 5000,
    });
    
    if (response.data && response.data.data) {
      return response.data.data.messagesToday || 0;
    }
  } catch (error) {
    return 0;
  }
}

// ============================================================================
// ERROR LOGS
// ============================================================================

async function getErrorLogs() {
  const logPath = path.join(__dirname, '../../backend/logs');
  
  if (!fs.existsSync(logPath)) {
    return 0;
  }

  try {
    const files = fs.readdirSync(logPath);
    let errorCount = 0;
    
    for (const file of files) {
      if (file.endsWith('.log')) {
        const content = fs.readFileSync(path.join(logPath, file), 'utf-8');
        const errorMatches = content.match(/error|Error|ERROR/g);
        if (errorMatches) {
          errorCount += errorMatches.length;
        }
      }
    }
    
    return errorCount;
  } catch (error) {
    return 0;
  }
}

// ============================================================================
// HEARTBEAT
// ============================================================================

async function sendHeartbeat() {
  try {
    const [cpuUsage, memoryUsage, diskUsage, uptime, sessions, messagesToday, errorsCount] = await Promise.all([
      getCpuUsage(),
      getMemoryUsage(),
      getDiskUsage(),
      Promise.resolve(getUptimeSeconds()),
      getWhatsAppSessions(),
      getMessagesToday(),
      getErrorLogs(),
    ]);

    const payload = {
      cpu_usage: parseFloat(cpuUsage),
      memory_usage: parseFloat(memoryUsage),
      disk_usage: diskUsage ? parseFloat(diskUsage) : null,
      uptime_seconds: uptime,
      active_sessions: sessions.active_sessions,
      total_sessions: sessions.total_sessions,
      whatsapp_connected: sessions.whatsapp_connected,
      messages_today: messagesToday,
      errors_count: errorsCount,
    };

    const response = await axios.post(
      `${config.masterApiUrl}/nodes/${config.nodeId}/heartbeat`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${config.token}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    if (response.data.success) {
      console.log(`[${new Date().toISOString()}] Heartbeat sent successfully`);
      
      // Process pending commands
      if (response.data.data.commands && response.data.data.commands.length > 0) {
        console.log(`[${new Date().toISOString()}] Received ${response.data.data.commands.length} commands`);
        for (const command of response.data.data.commands) {
          await executeCommand(command);
        }
      }
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Heartbeat failed:`, error.message);
  }
}

// ============================================================================
// COMMAND EXECUTION
// ============================================================================

async function executeCommand(command) {
  console.log(`[${new Date().toISOString()}] Executing command: ${command.command_type}`);
  
  try {
    let result = null;
    let error = null;

    switch (command.command_type) {
      case 'restart':
        result = await executeRestart();
        break;
      case 'update':
        result = await executeUpdate();
        break;
      case 'rebuild':
        result = await executeRebuild();
        break;
      case 'disconnect_whatsapp':
        result = await executeDisconnectWhatsApp();
        break;
      case 'backup':
        result = await executeBackup(command.payload);
        break;
      case 'clear_cache':
        result = await executeClearCache();
        break;
      default:
        throw new Error(`Unknown command: ${command.command_type}`);
    }

    // Send result back to master
    await axios.post(
      `${config.masterApiUrl}/nodes/${config.nodeId}/commands/${command.id}/result`,
      {
        status: 'completed',
        result: result,
      },
      {
        headers: {
          'Authorization': `Bearer ${config.token}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    console.log(`[${new Date().toISOString()}] Command ${command.command_type} completed`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Command ${command.command_type} failed:`, error.message);
    
    // Send error back to master
    await axios.post(
      `${config.masterApiUrl}/nodes/${config.nodeId}/commands/${command.id}/result`,
      {
        status: 'failed',
        error_message: error.message,
      },
      {
        headers: {
          'Authorization': `Bearer ${config.token}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );
  }
}

async function executeRestart() {
  // Restart the application (PM2 or docker)
  try {
    await execAsync('pm2 restart zapai-backend || docker-compose restart backend');
    return { message: 'Restart initiated' };
  } catch (error) {
    throw new Error('Restart failed');
  }
}

async function executeUpdate() {
  // Git pull and restart
  try {
    await execAsync('git pull');
    await execAsync('npm install');
    await execAsync('pm2 restart zapai-backend || docker-compose restart backend');
    return { message: 'Update completed' };
  } catch (error) {
    throw new Error('Update failed');
  }
}

async function executeRebuild() {
  // Rebuild and restart
  try {
    await execAsync('npm run build');
    await execAsync('pm2 restart zapai-backend || docker-compose restart backend');
    return { message: 'Rebuild completed' };
  } catch (error) {
    throw new Error('Rebuild failed');
  }
}

async function executeDisconnectWhatsApp() {
  // Disconnect all WhatsApp sessions
  try {
    await axios.post(`http://localhost:${config.localApiPort}/api/sessions/disconnect-all`, {
      timeout: 10000,
    });
    return { message: 'WhatsApp sessions disconnected' };
  } catch (error) {
    throw new Error('Failed to disconnect WhatsApp');
  }
}

async function executeBackup(payload) {
  // Create backup
  const backupType = payload?.type || 'full';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `/backups/backup-${timestamp}-${backupType}.tar.gz`;
  
  try {
    await execAsync(`mkdir -p /backups`);
    await execAsync(`tar -czf ${backupPath} /app/backend/data /app/backend/sessions`);
    return { message: 'Backup created', backup_path: backupPath };
  } catch (error) {
    throw new Error('Backup failed');
  }
}

async function executeClearCache() {
  // Clear application cache
  try {
    await execAsync('rm -rf /app/backend/.cache /app/backend/node_modules/.cache');
    return { message: 'Cache cleared' };
  } catch (error) {
    throw new Error('Failed to clear cache');
  }
}

// ============================================================================
// LOGS SENDING
// ============================================================================

async function sendLogs() {
  // This would read local logs and send to master
  // Implementation depends on logging system
}

// ============================================================================
// SESSIONS SYNC
// ============================================================================

async function syncSessions() {
  try {
    const response = await axios.get(`http://localhost:${config.localApiPort}/api/sessions`, {
      timeout: 5000,
    });
    
    if (response.data && response.data.data) {
      const sessions = response.data.data.map(s => ({
        session_id: s.id,
        session_name: s.name,
        phone_number: s.phone,
        status: s.connected ? 'connected' : 'disconnected',
      }));

      await axios.post(
        `${config.masterApiUrl}/nodes/${config.nodeId}/sessions`,
        { sessions },
        {
          headers: {
            'Authorization': `Bearer ${config.token}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );
    }
  } catch (error) {
    // Silent fail - local API might not be available
  }
}

// ============================================================================
// MAIN LOOP
// ============================================================================

async function main() {
  console.log(`[${new Date().toISOString()}] Master Node Agent starting`);
  console.log(`[${new Date().toISOString()}] Node ID: ${config.nodeId}`);
  console.log(`[${new Date().toISOString()}] Master API: ${config.masterApiUrl}`);
  console.log(`[${new Date().toISOString()}] Heartbeat interval: ${config.heartbeatInterval}ms`);

  if (!config.nodeId || !config.token) {
    console.error('ERROR: NODE_ID and NODE_TOKEN environment variables are required');
    process.exit(1);
  }

  // Send initial heartbeat
  await sendHeartbeat();
  
  // Sync sessions initially
  await syncSessions();

  // Start heartbeat loop
  const heartbeatInterval = setInterval(async () => {
    if (isRunning) {
      await sendHeartbeat();
    }
  }, config.heartbeatInterval);

  // Start sessions sync loop (every 5 minutes)
  const sessionsInterval = setInterval(async () => {
    if (isRunning) {
      await syncSessions();
    }
  }, 5 * 60 * 1000);

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log(`[${new Date().toISOString()}] Received SIGTERM, shutting down`);
    isRunning = false;
    clearInterval(heartbeatInterval);
    clearInterval(sessionsInterval);
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log(`[${new Date().toISOString()}] Received SIGINT, shutting down`);
    isRunning = false;
    clearInterval(heartbeatInterval);
    clearInterval(sessionsInterval);
    process.exit(0);
  });
}

// Start agent
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

module.exports = { sendHeartbeat, executeCommand };
