/**
 * ============================================================================
 * NODE AUTO REGISTER SERVICE
 * ============================================================================
 * 
 * Registra o nó no Master Admin automaticamente ao iniciar.
 * Envia heartbeat periódico.
 * ============================================================================
 */

const https = require('https');
const http = require('http');
const os = require('os');
const { spawnSync } = require('child_process');

class NodeRegisterService {
  constructor() {
    this.masterApiUrl = process.env.MASTER_API_URL || `http://127.0.0.1:${process.env.PORT || 4025}`;
    this.nodeToken = process.env.NODE_TOKEN;
    this.registrationToken = process.env.NODE_REGISTRATION_TOKEN || process.env.MASTER_TOKEN || '';
    const isMaster = String(process.env.MASTER || '').trim().toLowerCase() === 'true';
    this.nodeId = process.env.NODE_ID || (isMaster ? 'master' : this.generateNodeId());
    
    const rawAutoRegister = process.env.FEATURE_NODE_AUTO_REGISTER;
    if (isMaster) {
      this.autoRegisterEnabled = true;
    } else if (rawAutoRegister !== undefined) {
      this.autoRegisterEnabled = String(rawAutoRegister).trim().toLowerCase() === 'true';
    } else {
      this.autoRegisterEnabled = true;
    }
    this.heartbeatInterval = null;
  }

  generateNodeId() {
    return `node-${os.hostname()}-${Date.now()}`;
  }

  getPublicIP() {
    return new Promise((resolve) => {
      // Direct env check to avoid external network requests if possible
      const envUrl = process.env.APP_PUBLIC_URL || process.env.PUBLIC_URL || process.env.APP_URL || '';
      if (envUrl) {
        try {
          const hostname = new URL(envUrl).hostname;
          if (hostname && /^[0-9.]+$/.test(hostname)) {
            console.log('[NodeRegister] Resolved public IP from env:', hostname);
            return resolve(hostname);
          }
        } catch {}
      }

      const options = {
        hostname: 'ifconfig.me',
        port: 80,
        path: '/ip',
        method: 'GET',
        timeout: 3000,
        headers: {
          'User-Agent': 'curl/7.81.0'
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          const ip = data.trim();
          resolve(ip.length > 0 && ip.length <= 45 ? ip : '127.0.0.1');
        });
      });

      req.on('error', () => resolve('127.0.0.1'));
      req.on('timeout', () => {
        req.destroy();
        resolve('127.0.0.1');
      });
      req.end();
    });
  }

  async getCpuUsage() {
    const startMeasure = os.cpus().map(core => {
      const { user, nice, sys, idle, irq } = core.times;
      return {
        idle: idle,
        total: user + nice + sys + idle + irq
      };
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    const endMeasure = os.cpus().map(core => {
      const { user, nice, sys, idle, irq } = core.times;
      return {
        idle: idle,
        total: user + nice + sys + idle + irq
      };
    });

    let totalDiff = 0;
    let idleDiff = 0;

    for (let i = 0; i < startMeasure.length; i++) {
      totalDiff += endMeasure[i].total - startMeasure[i].total;
      idleDiff += endMeasure[i].idle - startMeasure[i].idle;
    }

    if (totalDiff === 0) return 0;
    const usage = 100 - Math.round((100 * idleDiff) / totalDiff);
    return Math.max(0, Math.min(100, usage));
  }

  async getSystemMetrics() {
    const cpus = os.cpus();
    const totalmem = os.totalmem();
    const freemem = os.freemem();
    const uptime = process.uptime();
    const cpuUsage = await this.getCpuUsage();

    const diskProbe = await new Promise((resolve) => {
      try {
        if (process.platform === 'win32') {
          const { exec } = require('child_process');
          exec('wmic logicaldisk where "DeviceID=\'C:\'" get Size,FreeSpace /value', {
            timeout: 2000,
            windowsHide: true
          }, (err, stdout) => {
            if (err) {
              return resolve({ total: 0, used: 0, free: 0, usedPercent: 0 });
            }
            const output = String(stdout || '');
            const size = Number((output.match(/Size=(\d+)/) || [])[1] || 0);
            const free = Number((output.match(/FreeSpace=(\d+)/) || [])[1] || 0);
            const used = size > 0 ? size - free : 0;
            const usedPercent = size > 0 ? Math.round((used / size) * 100) : 0;
            resolve({
              total: Math.round(size / 1024 / 1024),
              used: Math.round(used / 1024 / 1024),
              free: Math.round(free / 1024 / 1024),
              usedPercent,
            });
          });
        } else {
          const { exec } = require('child_process');
          exec('df -k /', {
            timeout: 2000,
            windowsHide: true
          }, (err, stdout) => {
            if (err) {
              return resolve({ total: 0, used: 0, free: 0, usedPercent: 0 });
            }
            const lines = String(stdout || '').trim().split(/\r?\n/);
            const data = String(lines[1] || '').trim().split(/\s+/);
            const totalKb = Number(data[1] || 0);
            const usedKb = Number(data[2] || 0);
            const freeKb = Number(data[3] || 0);
            const usedPercent = totalKb > 0 ? Math.round((usedKb / totalKb) * 100) : 0;
            resolve({
              total: Math.round(totalKb / 1024),
              used: Math.round(usedKb / 1024),
              free: Math.round(freeKb / 1024),
              usedPercent,
            });
          });
        }
      } catch {
        resolve({ total: 0, used: 0, free: 0, usedPercent: 0 });
      }
    });

    return {
      cpu: {
        cores: cpus.length,
        model: cpus[0]?.model || 'unknown',
        usage: cpuUsage,
      },
      ram: {
        total: Math.round(totalmem / 1024 / 1024), // MB
        free: Math.round(freemem / 1024 / 1024), // MB
        used: Math.round((totalmem - freemem) / 1024 / 1024), // MB
      },
      disk: diskProbe,
      uptime: {
        seconds: Math.floor(uptime),
        formatted: this.formatUptime(uptime),
      },
    };
  }

  formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours}h ${minutes}m ${secs}s`;
  }

  async registerNode() {
    if (!this.autoRegisterEnabled) {
      console.log('[NodeRegister] FEATURE_NODE_AUTO_REGISTER disabled, skipping auto-register');
      return;
    }

    if (!this.masterApiUrl) {
      console.log('[NodeRegister] MASTER_API_URL not configured, skipping auto-register');
      return;
    }

    try {
      const publicIP = await this.getPublicIP();
      const metrics = await this.getSystemMetrics();

      const payload = {
        node_id: this.nodeId,
        hostname: os.hostname(),
        ip: publicIP,
        ip_address: publicIP,
        name: os.hostname(),
        api_port: Number(process.env.PORT || 4025),
        version: process.env.npm_package_version || '1.0.0',
        online: true,
        metrics,
        timestamp: new Date().toISOString(),
      };

      const url = `${this.masterApiUrl}/api/master/register-node`;

      const registerResponse = await this.makeRequest(url, payload, {
        bearerToken: this.registrationToken || this.nodeToken || undefined,
        registrationToken: this.registrationToken || undefined,
      });

      const returnedToken = String(registerResponse?.token || registerResponse?.node?.token || '').trim();
      if (returnedToken) {
        this.nodeToken = returnedToken;
      }

      const returnedNodeId = String(registerResponse?.node?.node_id || '').trim();
      if (returnedNodeId) {
        this.nodeId = returnedNodeId;
      }
      
      console.log(`[NodeRegister] Node registered: ${this.nodeId} (${publicIP})`);
      
      // Iniciar heartbeat
      this.startHeartbeat();
    } catch (error) {
      console.error('[NodeRegister] Failed to register node:', error.message);
    }
  }

  async sendHeartbeat() {
    if (!this.masterApiUrl || !this.nodeToken) {
      return;
    }

    try {
      const metrics = await this.getSystemMetrics();
      
      const payload = {
        node_id: this.nodeId,
        metrics,
        cpu_usage: Number(metrics.cpu?.usage || 0),
        memory_usage: Number(metrics.ram?.total ? Math.round((metrics.ram.used / metrics.ram.total) * 100) : 0),
        disk_usage: Number(metrics.disk?.usedPercent || 0),
        uptime_seconds: Number(metrics.uptime?.seconds || 0),
        timestamp: new Date().toISOString(),
      };

      const url = `${this.masterApiUrl}/api/master/heartbeat`;

      await this.makeRequest(url, payload, {
        bearerToken: this.nodeToken,
      });

      const metricsArray = [
        { type: 'cpu', name: 'cpu.usage', value: payload.cpu_usage, unit: 'percent' },
        { type: 'ram', name: 'ram.total_mb', value: metrics.ram?.total || 0, unit: 'mb' },
        { type: 'ram', name: 'ram.used_mb', value: metrics.ram?.used || 0, unit: 'mb' },
        { type: 'ram', name: 'ram.usage', value: payload.memory_usage, unit: 'percent' },
        { type: 'disk', name: 'disk.usage', value: payload.disk_usage, unit: 'percent' },
        { type: 'system', name: 'system.uptime', value: payload.uptime_seconds, unit: 'seconds' }
      ];

      const metricsUrl = `${this.masterApiUrl}/api/cluster/metrics/ingest`;
      await this.makeRequest(metricsUrl, { node_id: this.nodeId, metrics: metricsArray }, {
        bearerToken: this.nodeToken,
      });

      console.log('[NodeRegister] Heartbeat & metrics sent');
    } catch (error) {
      console.error('[NodeRegister] Failed to send heartbeat:', error.message);
    }
  }

  startHeartbeat() {
    // Enviar heartbeat a cada 30 segundos
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 30000);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  async makeRequest(url, payload, options = {}) {
    const isHttps = url.startsWith('https://');
    const client = isHttps ? https : http;

    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(JSON.stringify(payload)),
    };

    if (options.bearerToken) {
      headers.Authorization = `Bearer ${options.bearerToken}`;
      headers['x-node-token'] = options.bearerToken;
    }

    if (options.registrationToken) {
      headers['x-registration-token'] = options.registrationToken;
    }

    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);

      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname,
        method: 'POST',
        headers,
      };

      const req = client.request(requestOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch {
              resolve({});
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.write(JSON.stringify(payload));
      req.end();
    });
  }
}

module.exports = new NodeRegisterService();
