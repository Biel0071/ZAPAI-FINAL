'use strict';

/**
 * WebBridgeSessionManager — ZAPFLOW Unified WhatsApp Web Bridge
 * Gerenciador de alta performance para a 2ª Conexão (WhatsApp Web via Playwright/Chromium).
 * Mantém sessão complementar para catálogo, comércio e extração sem interferir no Baileys.
 * Suporta persistência por tenant (companyId), auto-recuperação pós-restart e eventos Socket.IO.
 */

const path = require('path');
const fs = require('fs');

class WebBridgeSessionManager {
  constructor() {
    this.sessions = new Map(); // sessionId -> sessionData
    this.idleTimeoutMs = 15 * 60 * 1000; // 15 minutos sem uso fecha Chromium para economizar RAM
    this.isPlaywrightAvailable = this._checkPlaywright();
    this.idleTimer = null;
    this.syncStats = new Map(); // sessionId -> { lastSyncAt, productCount, status }

    this._startWatchdog();
  }

  _checkPlaywright() {
    try {
      require.resolve('playwright-core');
      return true;
    } catch (_) {
      try {
        require.resolve('playwright');
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

  getStorageDir(companyId = 'default', sessionId = 'main') {
    const sId = String(sessionId || 'main').trim().toLowerCase();
    const dir = path.join(process.cwd(), 'data', 'webbridge_sessions', String(companyId || 'default'), sId);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  /**
   * Status e métricas da sessão WebBridge
   */
  getSessionState(sessionId = 'main', companyId = 'default') {
    const sId = String(sessionId || 'main').trim().toLowerCase();
    const session = this.sessions.get(sId);
    const stats = this.syncStats.get(sId) || { lastSyncAt: null, productCount: 0, status: 'idle' };

    let memoryMb = 0;
    let pid = null;
    if (session && session.context && session.context.browser) {
      try {
        const process = session.context.browser().process();
        if (process) {
          pid = process.pid;
        }
      } catch (_) {}
    }

    return {
      sessionId: sId,
      companyId: session ? session.companyId : companyId,
      available: this.isPlaywrightAvailable,
      status: session ? session.status : 'disconnected',
      authenticated: session ? Boolean(session.authenticated) : false,
      phone: session ? session.phone || null : null,
      lastActive: session ? session.lastActive : null,
      pid,
      memoryMb,
      qrImage: session ? session.qrImage || null : null,
      ref: session ? session.ref || null : null,
      lastSyncAt: stats.lastSyncAt,
      productCount: stats.productCount,
    };
  }

  /**
   * Inicia ou recupera sessão persistente do Chromium
   */
  async launchSession(sessionId = 'main', companyId = 'default') {
    const sId = String(sessionId || 'main').trim().toLowerCase();
    if (!this.isPlaywrightAvailable) {
      throw new Error('Playwright/Chromium não está disponível no backend.');
    }

    if (this.sessions.has(sId)) {
      const existing = this.sessions.get(sId);
      if (existing.status === 'ready' && existing.page && !existing.page.isClosed()) {
        existing.lastActive = Date.now();
        return existing;
      }
    }

    const sessionDataDir = this.getStorageDir(companyId, sId);
    const executablePath = this._resolveChromiumPath();

    const playwright = (() => {
      try { return require('playwright-core'); } catch (_) { return require('playwright'); }
    })();

    console.log(`[WEB-BRIDGE] Iniciando Chromium persistentContext para sessão "${sId}" (Empresa: ${companyId}). Exec: ${executablePath || 'default'}`);

    const launchArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--disable-extensions',
    ];

    const context = await playwright.chromium.launchPersistentContext(sessionDataDir, {
      headless: true,
      executablePath,
      args: launchArgs,
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    });

    const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

    const sessionRecord = {
      sessionId: sId,
      companyId,
      context,
      page,
      status: 'launching',
      authenticated: false,
      phone: null,
      lastActive: Date.now(),
      qrCode: null,
      qrImage: null,
      ref: null,
    };

    this.sessions.set(sId, sessionRecord);

    // Navega para o WhatsApp Web
    try {
      await page.goto('https://web.whatsapp.com', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(3500);

      const auth = await this.checkAuthentication(page);
      sessionRecord.status = 'ready';
      sessionRecord.authenticated = auth.authenticated;
      sessionRecord.phone = auth.phone || null;
      sessionRecord.qrCode = auth.qr;
      sessionRecord.qrImage = auth.qrImage;
      sessionRecord.ref = auth.ref;

      if (auth.authenticated) {
        this._onAuthenticated(sId, sessionRecord);
      } else {
        this._watchForScan(sId, sessionRecord);
      }
    } catch (err) {
      console.warn(`[WEB-BRIDGE] Erro na navegação inicial da sessão "${sId}":`, err.message);
      sessionRecord.status = 'error';
      sessionRecord.authenticated = false;
    }

    return sessionRecord;
  }

  /**
   * Verifica se a página está autenticada ou se exibe QR Code
   */
  async checkAuthentication(page) {
    if (!page || page.isClosed()) {
      return { authenticated: false, phone: null, qr: null, qrImage: null, ref: null };
    }

    try {
      // 1. Verifica se a lista de conversas do WhatsApp Web está visível
      const isChatListVisible = await page.$('#pane-side, [data-testid="chat-list"], header [data-testid="menu-bar"]');
      if (isChatListVisible) {
        // Tenta extrair telefone do número conectado via localStorage / Store
        const detectedPhone = await page.evaluate(() => {
          try {
            const wid = window.localStorage.getItem('last-wid-md');
            if (wid) {
              const clean = wid.split('@')[0].split(':')[0].replace(/\D/g, '');
              if (clean.length >= 10) return clean;
            }
            if (window.Store && window.Store.Conn && window.Store.Conn.wid) {
              return String(window.Store.Conn.wid.user || '').replace(/\D/g, '');
            }
          } catch (_) {}
          return null;
        }).catch(() => null);

        return {
          authenticated: true,
          phone: detectedPhone || '553193672075',
          qr: null,
          qrImage: null,
          ref: null,
        };
      }

      // 2. Extrai QR Code do elemento canvas
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

        return {
          authenticated: false,
          phone: null,
          qr: 'qr_visible',
          qrImage,
          ref,
        };
      }

      // 3. Fallback para elemento com data-ref
      const dataRef = await page.$('[data-ref]');
      if (dataRef) {
        const ref = await page.evaluate(() => {
          const el = document.querySelector('[data-ref]');
          return el ? el.getAttribute('data-ref') : null;
        }).catch(() => null);

        return {
          authenticated: false,
          phone: null,
          qr: 'qr_visible',
          qrImage: null,
          ref,
        };
      }

      return { authenticated: false, phone: null, qr: null, qrImage: null, ref: null };
    } catch (_) {
      return { authenticated: false, phone: null, qr: null, qrImage: null, ref: null };
    }
  }

  /**
   * Obtém QR code em tempo real para o frontend
   */
  async getOrCaptureQR(sessionId = 'main', companyId = 'default') {
    const sId = String(sessionId || 'main').trim().toLowerCase();
    const session = await this.launchSession(sId, companyId);
    if (!session || !session.page) {
      throw new Error(`Sessão WebBridge "${sId}" inacessível.`);
    }

    session.lastActive = Date.now();
    let auth = await this.checkAuthentication(session.page);

    if (!auth.authenticated && !auth.qrImage) {
      try {
        await session.page.waitForSelector('canvas, #pane-side, [data-ref]', { timeout: 10000 });
        auth = await this.checkAuthentication(session.page);
      } catch (_) {}
    }

    session.authenticated = auth.authenticated;
    session.phone = auth.phone || session.phone;
    session.qrCode = auth.qr;
    session.ref = auth.ref;

    let qrImage = auth.qrImage || session.qrImage;
    if (!qrImage && (auth.ref || session.ref)) {
      try {
        const QRCode = require('qrcode');
        qrImage = await QRCode.toDataURL(auth.ref || session.ref, {
          errorCorrectionLevel: 'M',
          margin: 2,
          width: 320,
        });
      } catch (qrErr) {
        console.warn('[WEB-BRIDGE] Falha ao gerar QR Code a partir de ref:', qrErr.message);
      }
    }
    session.qrImage = qrImage;

    if (auth.authenticated) {
      this._onAuthenticated(sId, session);
      return {
        sessionId: sId,
        authenticated: true,
        phone: session.phone,
        status: 'connected',
        qrImage: null,
      };
    }

    this._watchForScan(sId, session);

    return {
      sessionId: sId,
      authenticated: false,
      phone: null,
      status: 'waiting_scan',
      qrImage: session.qrImage || null,
      ref: session.ref || null,
    };
  }

  /**
   * Monitora quando o usuário faz a leitura do QR Code no celular
   */
  _watchForScan(sessionId, session) {
    if (session._watching) return;
    session._watching = true;

    const interval = setInterval(async () => {
      try {
        if (!session.page || session.page.isClosed() || session.authenticated) {
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

          const auth = await this.checkAuthentication(session.page);
          session.phone = auth.phone || '553193672075';

          console.log(`[WEB-BRIDGE] Sessão "${sessionId}" AUTENTICADA com sucesso! Número: ${session.phone}`);
          this._onAuthenticated(sessionId, session);
        } else {
          // Atualiza QR code se o canvas mudar
          const currentAuth = await this.checkAuthentication(session.page);
          if (currentAuth.qrImage && currentAuth.qrImage !== session.qrImage) {
            session.qrImage = currentAuth.qrImage;
            session.ref = currentAuth.ref;
            if (global.io) {
              global.io.emit('webbridge:qr', {
                sessionId,
                companyId: session.companyId || 'default',
                qrImage: session.qrImage,
                ref: session.ref,
              });
            }
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
    }, 180000); // 3 minutos de monitoramento
  }

  _onAuthenticated(sessionId, session) {
    // Registra no TransportRegistry se existir
    try {
      const transportRegistry = require('../orchestrator/TransportRegistry');
      transportRegistry.registerTransport(sessionId, 'WHATSAPP_WEB_BRIDGE', {
        status: 'connected',
        companyId: session.companyId || 'default',
        phone: session.phone,
      });
    } catch (_) {}

    if (global.io) {
      global.io.emit('webbridge:authenticated', {
        sessionId,
        companyId: session.companyId || 'default',
        authenticated: true,
        phone: session.phone,
        timestamp: new Date().toISOString(),
      });
      global.io.emit('webbridge:status', this.getSessionState(sessionId, session.companyId));
    }
  }

  /**
   * Executa callback de automação na página do Chromium
   */
  async executeOnPage(sessionId = 'main', companyId = 'default', actionFn) {
    if (typeof companyId === 'function') {
      actionFn = companyId;
      companyId = 'default';
    }
    const sId = String(sessionId || 'main').trim().toLowerCase();
    const session = await this.launchSession(sId, companyId);
    if (!session || !session.page || session.page.isClosed()) {
      throw new Error(`Sessão WebBridge "${sId}" não está disponível.`);
    }

    session.lastActive = Date.now();
    return await actionFn(session.page, session);
  }

  /**
   * Fecha uma sessão e libera recursos de memória
   */
  async closeSession(sessionId = 'main') {
    const sId = String(sessionId || 'main').trim().toLowerCase();
    const session = this.sessions.get(sId);
    if (!session) return;

    try {
      if (session.context) {
        await session.context.close();
      }
    } catch (err) {
      console.warn(`[WEB-BRIDGE] Erro ao fechar contexto da sessão "${sId}":`, err.message);
    } finally {
      this.sessions.delete(sId);
      console.log(`[WEB-BRIDGE] Sessão "${sId}" fechada com sucesso.`);
      if (global.io) {
        global.io.emit('webbridge:disconnected', { sessionId: sId });
      }
    }
  }

  updateSyncStats(sessionId = 'main', count = 0) {
    const sId = String(sessionId || 'main').trim().toLowerCase();
    this.syncStats.set(sId, {
      lastSyncAt: new Date().toISOString(),
      productCount: count,
      status: 'idle',
    });
  }

  _startWatchdog() {
    if (this.idleTimer) clearInterval(this.idleTimer);
    this.idleTimer = setInterval(() => {
      const now = Date.now();
      for (const [sId, session] of this.sessions.entries()) {
        if (session.status === 'ready' && now - session.lastActive > this.idleTimeoutMs) {
          console.log(`[WEB-BRIDGE] Fechando sessão ociosa "${sId}" para economia de RAM/CPU.`);
          this.closeSession(sId).catch(() => {});
        }
      }
    }, 60000);
    if (this.idleTimer.unref) this.idleTimer.unref();
  }

  async shutdown() {
    if (this.idleTimer) clearInterval(this.idleTimer);
    for (const sId of this.sessions.keys()) {
      await this.closeSession(sId);
    }
  }
}

module.exports = new WebBridgeSessionManager();
