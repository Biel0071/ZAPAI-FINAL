'use strict';

/**
 * UnifiedWhatsAppOrchestrator — ZAPFLOW Master WhatsApp Core
 * Núcleo unificado de infraestrutura para Baileys + WhatsApp Web Bridge + Meta Cloud API + Commerce Engine.
 * Ponto único de entrada para operações do ecossistema WhatsApp no ZAPFLOW.
 */

const capabilityRegistry = require('./CapabilityRegistry');
const transportRegistry = require('./TransportRegistry');
const connectionOrchestrator = require('./ConnectionOrchestrator');
const operationRouter = require('./OperationRouter');
const messageDispatcher = require('./MessageDispatcher');
const eventNormalizer = require('./EventNormalizer');
const commerceEngine = require('./CommerceEngine');
const paymentEngine = require('./PaymentEngine');
const healthMonitor = require('./HealthMonitor');
const recoveryManager = require('./RecoveryManager');
const webBridgeManager = require('./WebBridgeManager');

class UnifiedWhatsAppOrchestrator {
  constructor() {
    this.capabilityRegistry = capabilityRegistry;
    this.transportRegistry = transportRegistry;
    this.connectionOrchestrator = connectionOrchestrator;
    this.operationRouter = operationRouter;
    this.messageDispatcher = messageDispatcher;
    this.eventNormalizer = eventNormalizer;
    this.commerceEngine = commerceEngine;
    this.paymentEngine = paymentEngine;
    this.healthMonitor = healthMonitor;
    this.recoveryManager = recoveryManager;
    this.webBridgeManager = webBridgeManager;

    // Feature Flag
    this.isEnabled = process.env.ENABLE_UNIFIED_ORCHESTRATOR !== 'false';
  }

  /**
   * Ponto central de execução de qualquer operação do WhatsApp
   */
  async execute(operation, payload, connectionContext) {
    return await this.operationRouter.execute(operation, payload, connectionContext);
  }

  /**
   * Registro e ciclo de vida de conexões
   */
  registerConnection(sessionId, sock, metadata) {
    return this.connectionOrchestrator.registerBaileysConnection(sessionId, sock, metadata);
  }

  handleDisconnection(sessionId, reason) {
    return this.connectionOrchestrator.handleBaileysDisconnection(sessionId, reason);
  }

  getConnectionState(sessionId) {
    return this.connectionOrchestrator.getUnifiedConnectionState(sessionId);
  }

  /**
   * Diagnóstico e saúde unificados
   */
  getHealth() {
    return this.healthMonitor.getSnapshot();
  }
}

module.exports = new UnifiedWhatsAppOrchestrator();
