'use strict';

/**
 * Unified WhatsApp Orchestrator Module Barrel
 */

const unifiedWhatsAppOrchestrator = require('./UnifiedWhatsAppOrchestrator');
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

unifiedWhatsAppOrchestrator.orchestrator = unifiedWhatsAppOrchestrator;
unifiedWhatsAppOrchestrator.capabilityRegistry = capabilityRegistry;
unifiedWhatsAppOrchestrator.transportRegistry = transportRegistry;
unifiedWhatsAppOrchestrator.connectionOrchestrator = connectionOrchestrator;
unifiedWhatsAppOrchestrator.operationRouter = operationRouter;
unifiedWhatsAppOrchestrator.messageDispatcher = messageDispatcher;
unifiedWhatsAppOrchestrator.eventNormalizer = eventNormalizer;
unifiedWhatsAppOrchestrator.commerceEngine = commerceEngine;
unifiedWhatsAppOrchestrator.paymentEngine = paymentEngine;
unifiedWhatsAppOrchestrator.healthMonitor = healthMonitor;
unifiedWhatsAppOrchestrator.recoveryManager = recoveryManager;
unifiedWhatsAppOrchestrator.webBridgeManager = webBridgeManager;

module.exports = unifiedWhatsAppOrchestrator;
