'use strict';

/**
 * ZAICommunicationEngine — Núcleo Mestre de Comunicação Proprietária ZAI
 * Ecossistema: Fênix OS + ZAI + ZAPFLOW
 * 
 * Centraliza e orquestra o Core Runtime, Protocol Intelligence,
 * Capability Registry, Transport Registry, Session Manager, Event Engine,
 * Message Engine, Commerce Engine, Web Bridge e API Gateway.
 */

const orchestrator = require('../orchestrator/UnifiedWhatsAppOrchestrator');
const protocolIntelligence = require('./ProtocolIntelligence');
const compatibilityEngine = require('./CompatibilityEngine');
const capabilityRegistry = require('../orchestrator/CapabilityRegistry');
const transportRegistry = require('../orchestrator/TransportRegistry');
const webBridgeManager = require('../orchestrator/WebBridgeManager');
const commerceEngine = require('../orchestrator/CommerceEngine');
const paymentEngine = require('../orchestrator/PaymentEngine');
const healthMonitor = require('../orchestrator/HealthMonitor');
const recoveryManager = require('../orchestrator/RecoveryManager');
const sessionManager = require('../sessionManager');

class ZAICommunicationEngine {
  constructor() {
    this.name = 'ZAI Communication Engine';
    this.version = '1.0.0-enterprise';
    this.orchestrator = orchestrator;
    this.protocolIntelligence = protocolIntelligence;
    this.compatibilityEngine = compatibilityEngine;
    this.capabilities = capabilityRegistry;
    this.transports = transportRegistry;
    this.webBridge = webBridgeManager;
    this.commerce = commerceEngine;
    this.payments = paymentEngine;
    this.health = healthMonitor;
    this.recovery = recoveryManager;
    this.sessions = sessionManager;
  }

  /**
   * Execução soberana de operações de comunicação no ecossistema ZAI
   */
  async execute(operation, payload, context = {}) {
    return await this.orchestrator.execute(operation, payload, context);
  }

  /**
   * Envio de mensagem de texto com inteligência de rota
   */
  async sendText(phone, text, context = {}) {
    return await this.execute(capabilityRegistry.OPERATIONS.SEND_TEXT, { phone, text }, context);
  }

  /**
   * Envio nativo de produto oficial do catálogo
   */
  async sendProduct(phone, product, context = {}) {
    const normalized = this.compatibilityEngine.normalizeProductPayload(product, 'Baileys');
    return await this.execute(capabilityRegistry.OPERATIONS.SEND_PRODUCT, { phone, product: normalized }, context);
  }

  /**
   * Envio de catálogo comercial ou resumo interativo
   */
  async sendCatalog(phone, catalogData, context = {}) {
    return await this.execute(capabilityRegistry.OPERATIONS.SEND_CATALOG, { phone, catalogData }, context);
  }

  /**
   * Obter estado completo de saúde e capacidades ativas
   */
  getSystemStatus(sessionId = 'main') {
    const session = this.sessions.getSession(sessionId);
    const bridgeState = this.webBridge.getSessionState(sessionId);
    const health = this.health.getSnapshot();

    return {
      engine: this.name,
      version: this.version,
      sessionId,
      connected: Boolean(session && session.status === 'connected'),
      phone: session?.phone || session?.extractedPhone || null,
      transports: this.transports.getTransports(sessionId),
      bridge: bridgeState,
      health,
      capabilities: this.capabilities.getCapabilities(),
    };
  }
}

module.exports = new ZAICommunicationEngine();
