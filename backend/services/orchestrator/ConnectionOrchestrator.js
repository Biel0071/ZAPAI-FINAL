'use strict';

/**
 * ConnectionOrchestrator — ZAPFLOW Unified WhatsApp Orchestrator
 * Gerencia a identidade lógica de cada conexão WhatsApp e orquestra
 * a inicialização e sincronização de estado entre os motores.
 */

const transportRegistry = require('./TransportRegistry');
const capabilityRegistry = require('./CapabilityRegistry');
const eventNormalizer = require('./EventNormalizer');
const webBridgeManager = require('./WebBridgeManager');

class ConnectionOrchestrator {
  constructor() {
    this.connections = new Map(); // sessionId -> logicalConnection
  }

  /**
   * Chamado quando o Baileys conclui autenticação ou abre conexão
   */
  registerBaileysConnection(sessionId, sock, metadata = {}) {
    const sId = String(sessionId || 'default').trim().toLowerCase();
    const phone = sock?.user?.id ? sock.user.id.split('@')[0].split(':')[0].replace(/\D/g, '') : (metadata.phone || null);
    const companyId = metadata.companyId || 'default';

    const connRecord = {
      sessionId: sId,
      companyId,
      phone,
      status: 'connected',
      connectedAt: new Date().toISOString(),
      userJid: sock?.user?.id || null,
      sock,
    };

    this.connections.set(sId, connRecord);

    // Registra Baileys no TransportRegistry como motor primário
    transportRegistry.registerTransport(sId, capabilityRegistry.ENGINES.BAILEYS, {
      status: 'connected',
      phone,
      companyId,
      custom: { userJid: connRecord.userJid },
    });

    eventNormalizer.normalizeConnection(capabilityRegistry.ENGINES.BAILEYS, sId, 'connected', connRecord);

    console.log(`[CONNECTION-ORCHESTRATOR] Baileys connection established for session "${sId}" (phone: ${phone})`);
    return connRecord;
  }

  /**
   * Chamado quando a conexão Baileys cai ou fecha
   */
  handleBaileysDisconnection(sessionId, reason = 'unknown') {
    const sId = String(sessionId || 'default').trim().toLowerCase();
    const conn = this.connections.get(sId);
    if (conn) {
      conn.status = 'disconnected';
      conn.disconnectedAt = new Date().toISOString();
      conn.disconnectReason = reason;
    }

    transportRegistry.deregisterTransport(sId, capabilityRegistry.ENGINES.BAILEYS);
    eventNormalizer.normalizeConnection(capabilityRegistry.ENGINES.BAILEYS, sId, 'disconnected', { reason });

    console.log(`[CONNECTION-ORCHESTRATOR] Baileys connection closed for session "${sId}" (reason: ${reason})`);
  }

  /**
   * Obtém o estado unificado da conexão para disponibilizar ao frontend
   */
  getUnifiedConnectionState(sessionId) {
    const sId = String(sessionId || 'default').trim().toLowerCase();
    const conn = this.connections.get(sId);
    const transports = transportRegistry.getTransports(sId);
    const webBridgeState = webBridgeManager.getSessionState(sId);

    const isBaileysOnline = transports.some(t => t.engine === capabilityRegistry.ENGINES.BAILEYS && t.status === 'connected');

    return {
      sessionId: sId,
      status: isBaileysOnline ? 'connected' : (conn?.status || 'disconnected'),
      phone: conn?.phone || null,
      companyId: conn?.companyId || 'default',
      primaryEngine: capabilityRegistry.ENGINES.BAILEYS,
      activeEngines: transports.map(t => t.engine),
      capabilities: capabilityRegistry.getFullMatrix({
        webBridgeAuthenticated: webBridgeState.authenticated,
        hasCloudCredentials: false,
      }),
      webBridge: {
        available: webBridgeState.available,
        status: webBridgeState.status,
        authenticated: webBridgeState.authenticated,
      },
    };
  }
}

module.exports = new ConnectionOrchestrator();
