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

class NodeRegisterService {
  constructor() {
    this.masterApiUrl = process.env.MASTER_API_URL;
    this.nodeToken = process.env.NODE_TOKEN;
    this.nodeId = process.env.NODE_ID || this.generateNodeId();
    this.heartbeatInterval = null;
  }

  generateNodeId() {
    return `node-${os.hostname()}-${Date.now()}`;
  }

  getPublicIP() {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'ifconfig.me',
        port: 80,
        path: '/',
        method: 'GET',
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => resolve(data.trim()));
      });

      req.on('error', reject);
      req.end();
    });
  }

  async getSystemMetrics() {
    const cpus = os.cpus();
    const totalmem = os.totalmem();
    const freemem = os.freemem();
    const uptime = process.uptime();

    return {
      cpu: {
        cores: cpus.length,
        model: cpus[0]?.model || 'unknown',
      },
      ram: {
        total: Math.round(totalmem / 1024 / 1024), // MB
        free: Math.round(freemem / 1024 / 1024), // MB
        used: Math.round((totalmem - freemem) / 1024 / 1024), // MB
      },
      disk: {
        // Placeholder - seria necessário usar fs para obter disk real
        total: 0,
        used: 0,
      },
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
    if (!this.masterApiUrl || !this.nodeToken) {
      console.log('[NodeRegister] MASTER_API_URL or NODE_TOKEN not configured, skipping auto-register');
      return;
    }

    try {
      const publicIP = await this.getPublicIP();
      const metrics = await this.getSystemMetrics();

      const payload = {
        node_id: this.nodeId,
        hostname: os.hostname(),
        ip: publicIP,
        version: process.env.npm_package_version || '1.0.0',
        online: true,
        metrics,
        timestamp: new Date().toISOString(),
      };

      const url = `${this.masterApiUrl}/master/register-node`;
      
      await this.makeRequest(url, payload);
      
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
        timestamp: new Date().toISOString(),
      };

      const url = `${this.masterApiUrl}/master/heartbeat`;
      
      await this.makeRequest(url, payload);
      
      console.log('[NodeRegister] Heartbeat sent');
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

  async makeRequest(url, payload) {
    const isHttps = url.startsWith('https://');
    const client = isHttps ? https : http;

    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.nodeToken}`,
          'Content-Length': Buffer.byteLength(JSON.stringify(payload)),
        },
      };

      const req = client.request(options, (res) => {
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
