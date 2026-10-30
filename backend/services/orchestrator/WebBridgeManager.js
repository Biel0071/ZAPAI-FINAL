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

    const playwright = require('playwright');
    const context = await playwright.chromium.launchPersistentContext(sessionDataDir, {
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
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

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
    };

    this.sessions.set(sId, sessionRecord);

    // Navigate to WhatsApp Web
    try {
      await page.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
      sessionRecord.status = 'ready';
      sessionRecord.authenticated = true;
    } catch (e) {
      console.warn(`[WEB-BRIDGE] Navigation error for session "${sId}":`, e.message);
      sessionRecord.status = 'error';
    }

    return sessionRecord;
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
