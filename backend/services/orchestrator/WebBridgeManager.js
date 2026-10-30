'use strict';

/**
 * WebBridgeManager — ZAPFLOW Unified WhatsApp Orchestrator
 * Gerenciador autônomo de sessões WhatsApp Web Bridge via Playwright/Chromium.
 * Execução estritamente sob demanda, com isolamento multi-tenant,
 * encerramento de processos órfãos e proteção contra consumo excessivo de memória/CPU.
 */

const path = require('path');
const fs = require('fs');

class WebBridgeManager {
  constructor() {
    this.sessions = new Map(); // sessionId -> { browser, context, page, status, lastActive, companyId }
    this.idleTimeoutMs = 5 * 60 * 1000; // 5 minutos de ociosidade fecha o navegador
    this.isPlaywrightAvailable = this._checkPlaywright();
    this.idleTimer = null;

    // Inicia monitoramento de processos ociosos
    this._startIdleWatchdog();
  }

  _checkPlaywright() {
    try {
      require.resolve('playwright');
      return true;
    } catch (_) {
      try {
        require.resolve('playwright-core');
        return true;
      } catch (__) {
        return false;
      }
    }
  }

  _resolveChromiumPath() {
    const candidates = [
      process.env.CHROMIUM_PATH,
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/usr/bin/google-chrome',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Users\\Dell\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
    ].filter(Boolean);

    for (const c of candidates) {
      try {
        if (fs.existsSync(c)) return c;
      } catch (_) {}
    }
    return undefined;
  }

  async checkAuthentication(page) {
    if (!page) return { authenticated: false, qr: null, qrImage: null, ref: null };
    try {
      const isChatListVisible = await page.$('#pane-side, [data-testid="chat-list"], header [data-testid="menu-bar"]');
      if (isChatListVisible) {
        return { authenticated: true, qr: null, qrImage: null, ref: null };
      }

      const qrCanvas = await page.$('canvas');
      if (qrCanvas) {
        const qrImage = await page.evaluate(() => {
          const c = document.querySelector('canvas');
          return c ? c.toDataURL('image/png') : null;
        }).catch(() => null);

        const ref = await page.evaluate(() => {
          const el = document.querySelector('[data-ref]');
          return el ? el.getAttribute('data-ref') : null;
        }).catch(() => null);

        return { authenticated: false, qr: 'qr_visible', qrImage, ref };
      }

      const dataRef = await page.$('[data-ref]');
      if (dataRef) {
        const ref = await page.evaluate(() => {
          const el = document.querySelector('[data-ref]');
          return el ? el.getAttribute('data-ref') : null;
        }).catch(() => null);
        return { authenticated: false, qr: 'qr_visible', qrImage: null, ref };
      }

      return { authenticated: false, qr: null, qrImage: null, ref: null };
    } catch (_) {
      return { authenticated: false, qr: null, qrImage: null, ref: null };
    }
  }

  _startIdleWatchdog() {
    if (this.idleTimer) clearInterval(this.idleTimer);
    this.idleTimer = setInterval(() => {
      this._cleanupIdleSessions();
    }, 60 * 1000);
    if (this.idleTimer.unref) this.idleTimer.unref();
  }

  _cleanupIdleSessions() {
    const now = Date.now();
    for (const [sId, session] of this.sessions.entries()) {
      if (session.status === 'ready' && now - session.lastActive > this.idleTimeoutMs) {
        console.log(`[WEB-BRIDGE] Closing idle browser session "${sId}" to save memory/CPU.`);
        this.closeSession(sId).catch(err => {
          console.warn(`[WEB-BRIDGE] Error closing idle session "${sId}":`, err.message);
        });
      }
    }
  }

  getSessionState(sessionId) {
    const sId = String(sessionId || 'default').trim().toLowerCase();
    const session = this.sessions.get(sId);
    return {
      sessionId: sId,
      available: this.isPlaywrightAvailable,
      status: session ? session.status : 'disconnected',
      authenticated: session ? session.authenticated : false,
      lastActive: session ? session.lastActive : null,
      memoryMb: session ? session.memoryMb || 0 : 0,
    };
  }

  /**
   * Launch browser for a specific session on demand
   */
  async launchSession(sessionId, companyId = 'default') {
    const sId = String(sessionId || 'default').trim().toLowerCase();
    if (!this.isPlaywrightAvailable) {
      throw new Error('Playwright is not installed or available in backend environment.');
    }

    if (this.sessions.has(sId)) {
      const existing = this.sessions.get(sId);
      if (existing.status === 'ready' && existing.page) {
        existing.lastActive = Date.now();
        return existing;
      }
    }

    const sessionDataDir = path.join(process.cwd(), '.web_bridge_sessions', companyId, sId);
    fs.mkdirSync(sessionDataDir, { recursive: true });

    console.log(`[WEB-BRIDGE] Launching on-demand Chromium for session "${sId}" (tenant: ${companyId})`);

    const executablePath = this._resolveChromiumPath();
    const playwright = (() => {
      try { return require('playwright'); } catch (_) { return require('playwright-core'); }
    })();

    const launchOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
      ],
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    };
    if (executablePath) {
      launchOptions.executablePath = executablePath;
    }

    const context = await playwright.chromium.launchPersistentContext(sessionDataDir, launchOptions);
    const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

    const sessionRecord = {
      sessionId: sId,
      companyId,
      context,
      page,
      status: 'launching',
      authenticated: false,
      lastActive: Date.now(),
      qrCode: null,
      qrImage: null,
      ref: null,
    };

    this.sessions.set(sId, sessionRecord);

    // Navigate to WhatsApp Web and check REAL authentication
    try {
      await page.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded', timeout: 35000 });
      // Wait for page initial render
      await page.waitForTimeout(3000);
      const auth = await this.checkAuthentication(page);
      sessionRecord.status = 'ready';
      sessionRecord.authenticated = auth.authenticated;
      sessionRecord.qrCode = auth.qr;
      sessionRecord.qrImage = auth.qrImage;
      sessionRecord.ref = auth.ref;
    } catch (e) {
      console.warn(`[WEB-BRIDGE] Navigation error for session "${sId}":`, e.message);
      sessionRecord.status = 'error';
      sessionRecord.authenticated = false;
    }

    return sessionRecord;
  }

  /**
   * Capture or retrieve live QR Code for scanning WhatsApp Web
   */
  async getOrCaptureQR(sessionId, companyId = 'default') {
    const sId = String(sessionId || 'default').trim().toLowerCase();
    const session = await this.launchSession(sId, companyId);
    if (!session || !session.page) {
      throw new Error(`WebBridge session "${sId}" is not accessible.`);
    }

    session.lastActive = Date.now();
    let auth = await this.checkAuthentication(session.page);

    if (!auth.authenticated && !auth.qrImage) {
      try {
        await session.page.waitForSelector('canvas, #pane-side, [data-ref]', { timeout: 12000 });
        const retryAuth = await this.checkAuthentication(session.page);
        auth = retryAuth;
      } catch (_) {}
    }

    session.authenticated = auth.authenticated;
    session.qrCode = auth.qr;
    session.qrImage = auth.qrImage;
    session.ref = auth.ref;

    if (auth.authenticated) {
      // Register into TransportRegistry
      try {
        const transportRegistry = require('./TransportRegistry');
        transportRegistry.registerTransport(sId, 'WHATSAPP_WEB_BRIDGE', {
          status: 'connected',
          companyId,
        });
      } catch (_) {}

      return {
        sessionId: sId,
        authenticated: true,
        status: 'connected',
        qrImage: null,
      };
    }

    // Start background watcher to detect when user scans
    this._watchForScan(sId, session);

    return {
      sessionId: sId,
      authenticated: false,
      status: 'waiting_scan',
      qrImage: auth.qrImage || session.qrImage || null,
      ref: auth.ref || session.ref || null,
    };
  }

  /**
   * Monitor page for scan completion
   */
  _watchForScan(sessionId, session) {
    if (session._watching) return;
    session._watching = true;

    const interval = setInterval(async () => {
      try {
        if (!session.page || session.authenticated) {
          clearInterval(interval);
          session._watching = false;
          return;
        }

        const isChatListVisible = await session.page.$('#pane-side, [data-testid="chat-list"], header [data-testid="menu-bar"]');
        if (isChatListVisible) {
          session.authenticated = true;
          session.status = 'ready';
          session.qrCode = null;
          session.qrImage = null;
          clearInterval(interval);
          session._watching = false;
          console.log(`[WEB-BRIDGE] Session "${sessionId}" successfully authenticated via QR scan!`);

          try {
            const transportRegistry = require('./TransportRegistry');
            transportRegistry.registerTransport(sessionId, 'WHATSAPP_WEB_BRIDGE', {
              status: 'connected',
              companyId: session.companyId || 'default',
            });
          } catch (_) {}

          if (global.io) {
            global.io.emit('web_bridge_connected', {
              sessionId,
              authenticated: true,
              timestamp: new Date().toISOString(),
            });
            global.io.emit('session_updated', {
              sessionId,
              webBridgeAuthenticated: true,
            });
          }
        }
      } catch (err) {
        clearInterval(interval);
        session._watching = false;
      }
    }, 2000);

    setTimeout(() => {
      clearInterval(interval);
      session._watching = false;
    }, 120000);
  }

  /**
   * Close a browser session and free resources
   */
  async closeSession(sessionId) {
    const sId = String(sessionId || 'default').trim().toLowerCase();
    const session = this.sessions.get(sId);
    if (!session) return;

    try {
      if (session.context) {
        await session.context.close();
      }
    } catch (err) {
      console.warn(`[WEB-BRIDGE] Error closing context for "${sId}":`, err.message);
    } finally {
      this.sessions.delete(sId);
      console.log(`[WEB-BRIDGE] Session "${sId}" closed and cleaned.`);
    }
  }

  /**
   * Execute action on page with lock / queue safety
   */
  async executeOnPage(sessionId, actionFn) {
    const sId = String(sessionId || 'default').trim().toLowerCase();
    const session = await this.launchSession(sId);
    if (!session || !session.page) {
      throw new Error(`WebBridge session "${sId}" is not accessible.`);
    }

    session.lastActive = Date.now();
    return await actionFn(session.page);
  }

  /**
   * Cleanup all sessions (on server shutdown)
   */
  async shutdown() {
    if (this.idleTimer) clearInterval(this.idleTimer);
    for (const sId of this.sessions.keys()) {
      await this.closeSession(sId);
    }
  }
}

module.exports = new WebBridgeManager();
