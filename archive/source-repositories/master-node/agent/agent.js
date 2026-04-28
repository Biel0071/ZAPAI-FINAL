const axios = require('axios');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
require('dotenv').config();

const execAsync = promisify(exec);

const config = {
  masterApiUrl: process.env.MASTER_API_URL || 'http://localhost:5000/api',
  nodeId: process.env.NODE_ID,
  token: process.env.NODE_TOKEN,
  heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || '30000', 10),
  localApiPort: process.env.LOCAL_API_PORT || 4025,
  nodeName: process.env.NODE_NAME || os.hostname(),
  nodeDomain: process.env.NODE_DOMAIN || '',
  nodeVersion: process.env.NODE_VERSION || process.env.VERSION || '1.0.0',
  registrationToken: process.env.NODE_REGISTRATION_TOKEN || '',
  clientId: process.env.CLIENT_ID || '',
  clientName: process.env.CLIENT_NAME || '',
  credentialsPath: process.env.NODE_CREDENTIALS_PATH || path.join(__dirname, '.agent-credentials.json'),
  localLogPath: process.env.NODE_AGENT_LOG_FILE || path.join(__dirname, 'agent.log'),
};

let isRunning = true;
let uptimeStart = Date.now();
let registered = false;
let failedHeartbeats = 0;
const pendingLogBuffer = [];

function log(level, message, metadata = {}) {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    metadata,
  });

  const rendered = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`;
  if (level === 'error') {
    console.error(rendered);
  } else {
    console.log(rendered);
  }

  try {
    fs.appendFileSync(config.localLogPath, `${line}\n`);
  } catch (_error) {
  }

  pendingLogBuffer.push({
    level,
    service: 'node-agent',
    message,
    metadata,
  });

  if (pendingLogBuffer.length > 300) {
    pendingLogBuffer.splice(0, pendingLogBuffer.length - 300);
  }
}

function persistCredentials() {
  const payload = {
    nodeId: config.nodeId,
    token: config.token,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(config.credentialsPath, JSON.stringify(payload, null, 2));
}

function restoreCredentials() {
  if (!fs.existsSync(config.credentialsPath)) {
    return;
  }

  try {
    const raw = fs.readFileSync(config.credentialsPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!config.nodeId && parsed.nodeId) {
      config.nodeId = parsed.nodeId;
    }
    if (!config.token && parsed.token) {
      config.token = parsed.token;
    }
  } catch (error) {
    log('warn', 'Failed to restore credentials file', { error: error.message });
  }
}

async function detectPublicIp() {
  const providers = [
    'https://api.ipify.org?format=json',
    'https://ifconfig.me/all.json',
    'https://ipinfo.io/json',
  ];

  for (const url of providers) {
    try {
      const response = await axios.get(url, { timeout: 8000 });
      const ip = response.data?.ip || response.data?.ip_addr || response.data?.IP;
      if (ip) {
        return ip;
      }
    } catch (_error) {
    }
  }

  return '127.0.0.1';
}

async function registerIfNeeded() {
  if (config.nodeId && config.token) {
    registered = true;
    return;
  }

  const ipAddress = await detectPublicIp();
  const payload = {
    name: config.nodeName,
    hostname: os.hostname(),
    ip_address: ipAddress,
    domain: config.nodeDomain || null,
    api_port: Number(config.localApiPort),
    version: config.nodeVersion,
    client_id: config.clientId || undefined,
    client_name: config.clientName || undefined,
  };

  const headers = { 'Content-Type': 'application/json' };
  if (config.registrationToken) {
    headers['x-registration-token'] = config.registrationToken;
  }

  const response = await axios.post(
    `${config.masterApiUrl}/nodes/register`,
    payload,
    {
      headers,
      timeout: 15000,
    }
  );

  const nodeId = response.data?.data?.node_id;
  const token = response.data?.data?.token;

  if (!nodeId || !token) {
    throw new Error('Master did not return node credentials');
  }

  config.nodeId = nodeId;
  config.token = token;
  registered = true;
  persistCredentials();
  log('info', 'Node registered successfully', { nodeId, ipAddress });
}

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
  } catch (_error) {
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
  } catch (_error) {
    return 0;
  }
}

async function getErrorLogs() {
  const logPath = path.join(__dirname, '..', '..', 'backend', 'logs');
  
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

async function flushRemoteLogs() {
  if (!registered || !config.nodeId || !config.token || pendingLogBuffer.length === 0) {
    return;
  }

  const batch = pendingLogBuffer.splice(0, 30);
  try {
    await axios.post(
      `${config.masterApiUrl}/nodes/${config.nodeId}/logs`,
      { logs: batch },
      {
        headers: {
          Authorization: `Bearer ${config.token}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );
  } catch (error) {
    pendingLogBuffer.unshift(...batch);
    if (pendingLogBuffer.length > 300) {
      pendingLogBuffer.splice(300);
    }
    log('warn', 'Failed to send logs to master', { error: error.message });
  }
}

async function sendHeartbeat() {
  try {
    if (!registered) {
      await registerIfNeeded();
    }

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
      version: config.nodeVersion,
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
      failedHeartbeats = 0;
      log('info', 'Heartbeat sent successfully', { nodeId: config.nodeId });

      if (response.data.data.commands && response.data.data.commands.length > 0) {
        log('info', 'Received pending commands', { count: response.data.data.commands.length });
        for (const command of response.data.data.commands) {
          await executeCommand(command);
        }
      }

      await flushRemoteLogs();
    }
  } catch (error) {
    failedHeartbeats += 1;

    if (error.response?.status === 401 || error.response?.status === 404) {
      registered = false;
      config.nodeId = '';
      config.token = '';
      try {
        fs.unlinkSync(config.credentialsPath);
      } catch (_removeError) {
      }
    }

    log('error', 'Heartbeat failed', {
      error: error.message,
      failedHeartbeats,
      status: error.response?.status || null,
    });
  }
}

async function executeCommand(command) {
  log('info', 'Executing command', { type: command.command_type, commandId: command.id });
  
  try {
    let result = null;

    switch (command.command_type) {
      case 'restart':
        result = await executeRestart();
        break;
      case 'deploy':
        result = await executeDeploy(command.payload);
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

    log('info', 'Command completed', { type: command.command_type, commandId: command.id });
  } catch (error) {
    log('error', 'Command failed', { type: command.command_type, commandId: command.id, error: error.message });

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
  try {
    await execAsync('docker compose restart backend || docker-compose restart backend || systemctl restart zapai-backend');
    return { message: 'Restart initiated' };
  } catch (_error) {
    throw new Error('Restart failed');
  }
}

async function executeDeploy(payload) {
  const ref = payload?.ref || 'main';

  try {
    await execAsync(`git fetch origin ${ref}`);
    await execAsync(`git checkout ${ref}`);
    await execAsync('git pull --rebase origin main || true');
    await execAsync('docker compose build --pull backend frontend || docker-compose build backend frontend');
    await execAsync('docker compose up -d backend frontend || docker-compose up -d backend frontend');
    return { message: 'Deploy completed', ref };
  } catch (_error) {
    throw new Error('Deploy failed');
  }
}

async function executeUpdate() {
  try {
    await execAsync('git pull --rebase origin main');
    await execAsync('docker compose up -d --build backend || docker-compose up -d --build backend');
    return { message: 'Update completed' };
  } catch (_error) {
    throw new Error('Update failed');
  }
}

async function executeRebuild() {
  try {
    await execAsync('docker compose build backend frontend || docker-compose build backend frontend');
    await execAsync('docker compose up -d backend frontend || docker-compose up -d backend frontend');
    return { message: 'Rebuild completed' };
  } catch (_error) {
    throw new Error('Rebuild failed');
  }
}

async function executeDisconnectWhatsApp() {
  try {
    await axios.post(`http://localhost:${config.localApiPort}/api/sessions/disconnect-all`, {
      timeout: 10000,
    });
    return { message: 'WhatsApp sessions disconnected' };
  } catch (_error) {
    throw new Error('Failed to disconnect WhatsApp');
  }
}

async function executeBackup(payload) {
  const backupType = payload?.type || 'full';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `/backups/backup-${timestamp}-${backupType}.tar.gz`;
  
  try {
    await execAsync(`mkdir -p /backups`);
    await execAsync(`tar -czf ${backupPath} /app/backend/data /app/backend/sessions`);
    return { message: 'Backup created', backup_path: backupPath };
  } catch (_error) {
    throw new Error('Backup failed');
  }
}

async function executeClearCache() {
  try {
    await execAsync('rm -rf /app/backend/.cache /app/backend/node_modules/.cache');
    return { message: 'Cache cleared' };
  } catch (_error) {
    throw new Error('Failed to clear cache');
  }
}

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
  } catch (_error) {
  }
}

async function main() {
  restoreCredentials();

  log('info', 'Master Node Agent starting');
  log('info', 'Agent config loaded', {
    masterApiUrl: config.masterApiUrl,
    nodeId: config.nodeId || null,
    heartbeatInterval: config.heartbeatInterval,
    hostname: os.hostname(),
  });

  await registerIfNeeded();

  await sendHeartbeat();
  await syncSessions();

  const heartbeatInterval = setInterval(async () => {
    if (isRunning) {
      await sendHeartbeat();
    }
  }, config.heartbeatInterval);

  const sessionsInterval = setInterval(async () => {
    if (isRunning) {
      await syncSessions();
    }
  }, 5 * 60 * 1000);

  process.on('SIGTERM', () => {
    log('warn', 'Received SIGTERM, shutting down');
    isRunning = false;
    clearInterval(heartbeatInterval);
    clearInterval(sessionsInterval);
    process.exit(0);
  });

  process.on('SIGINT', () => {
    log('warn', 'Received SIGINT, shutting down');
    isRunning = false;
    clearInterval(heartbeatInterval);
    clearInterval(sessionsInterval);
    process.exit(0);
  });
}

main().catch(error => {
  log('error', 'Fatal error', { error: error.message });
  process.exit(1);
});

module.exports = { sendHeartbeat, executeCommand };
