'use strict';

/**
 * TransportRegistry — ZAPFLOW Unified WhatsApp Orchestrator
 * Registra quais motores estão disponíveis para cada número e sessão.
 */

const capabilityRegistry = require('./CapabilityRegistry');

class TransportRegistry {
  constructor() {
    // Map of sessionId -> Map of engineName -> transportMetadata
    this.transports = new Map();
  }

  /**
   * Register or update an active transport for a session
   */
  registerTransport(sessionId, engineName, metadata = {}) {
    const sId = String(sessionId || 'default').trim().toLowerCase();
    if (!this.transports.has(sId)) {
      this.transports.set(sId, new Map());
    }

    const sessionTransports = this.transports.get(sId);
    sessionTransports.set(engineName, {
      engine: engineName,
      status: metadata.status || 'connected',
      phone: metadata.phone || null,
      companyId: metadata.companyId || 'default',
      lastSeen: new Date().toISOString(),
      metadata: metadata.custom || {},
    });

    console.log(`[TRANSPORT-REGISTRY] Registered engine ${engineName} for session "${sId}" (status: ${metadata.status || 'connected'})`);
  }

  /**
   * Deregister a transport when disconnected
   */
  deregisterTransport(sessionId, engineName) {
    const sId = String(sessionId || 'default').trim().toLowerCase();
    if (this.transports.has(sId)) {
      const sessionTransports = this.transports.get(sId);
      sessionTransports.delete(engineName);
      console.log(`[TRANSPORT-REGISTRY] Deregistered engine ${engineName} for session "${sId}"`);
    }
  }

  /**
   * Get all active transports for a session
   */
  getTransports(sessionId) {
    const sId = String(sessionId || 'default').trim().toLowerCase();
    const sessionTransports = this.transports.get(sId);
    if (!sessionTransports) return [];
    return Array.from(sessionTransports.values());
  }

  /**
   * Check if a specific engine is available for a session
   */
  isAvailable(sessionId, engineName) {
    const sId = String(sessionId || 'default').trim().toLowerCase();
    const sessionTransports = this.transports.get(sId);
    if (!sessionTransports) return false;
    const transport = sessionTransports.get(engineName);
    return Boolean(transport && transport.status === 'connected');
  }

  /**
   * Get best available engine for an operation
   */
  selectEngineForOperation(sessionId, operation, context = {}) {
    const sId = String(sessionId || 'default').trim().toLowerCase();
    const active = this.getTransports(sId);

    // Baileys is the primary, lightweight default for all WhatsApp operations
    let hasBaileys = active.some(t => t.engine === capabilityRegistry.ENGINES.BAILEYS && t.status === 'connected');

    // Auto-discover from active sessionManager if not yet registered in transport map
    if (!hasBaileys) {
      try {
        const sessionManager = require('../sessionManager');
        const s = sessionManager.getSession(sId) || (typeof sessionManager.getConnectedSessionOrNull === 'function' ? sessionManager.getConnectedSessionOrNull() : null);
        if (s && s.sock && String(s.status || '').toLowerCase() === 'connected') {
          this.registerTransport(sId, capabilityRegistry.ENGINES.BAILEYS, {
            status: 'connected',
            phone: s.phone || null,
            companyId: s.companyId || context.companyId || 'default',
          });
          hasBaileys = true;
        }
      } catch (_) {}
    }
    const hasWebBridge = active.some(t => t.engine === capabilityRegistry.ENGINES.WHATSAPP_WEB_BRIDGE && t.status === 'connected');
    const hasCloud = active.some(t => t.engine === capabilityRegistry.ENGINES.CLOUD_API && t.status === 'connected');

    // 1. If explicit engine is requested in context and capable, honor it
    if (context.preferredEngine && active.some(t => t.engine === context.preferredEngine)) {
      if (capabilityRegistry.canExecute(context.preferredEngine, operation, context)) {
        return context.preferredEngine;
      }
    }

    // 2. Standard preference: Baileys handles 100% of standard messaging and native protobuf commerce
    if (hasBaileys && capabilityRegistry.canExecute(capabilityRegistry.ENGINES.BAILEYS, operation, context)) {
      return capabilityRegistry.ENGINES.BAILEYS;
    }

    // 3. Fallback to WebBridge if Baileys unavailable or if WebBridge has specific capability
    if (hasWebBridge && capabilityRegistry.canExecute(capabilityRegistry.ENGINES.WHATSAPP_WEB_BRIDGE, operation, context)) {
      return capabilityRegistry.ENGINES.WHATSAPP_WEB_BRIDGE;
    }

    // 4. Fallback to CloudAPI if configured
    if (hasCloud && capabilityRegistry.canExecute(capabilityRegistry.ENGINES.CLOUD_API, operation, context)) {
      return capabilityRegistry.ENGINES.CLOUD_API;
    }

    // Default fallback to BAILEYS if nothing else
    return hasBaileys ? capabilityRegistry.ENGINES.BAILEYS : null;
  }
}

module.exports = new TransportRegistry();
