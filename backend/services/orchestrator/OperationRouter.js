'use strict';

/**
 * OperationRouter — ZAPFLOW Unified WhatsApp Orchestrator
 * Roteamento inteligente de operações para o melhor motor disponível.
 * Implementa execute(operation, payload, connectionContext) com
 * proteção de idempotência, validação de capacidade e registro de telemetria.
 */

const capabilityRegistry = require('./CapabilityRegistry');
const transportRegistry = require('./TransportRegistry');
const baileysAdapter = require('./adapters/BaileysAdapter');
const whatsAppWebAdapter = require('./adapters/WhatsAppWebAdapter');
const cloudAPIAdapter = require('./adapters/CloudAPIAdapter');
const eventNormalizer = require('./EventNormalizer');
const healthMonitor = require('./HealthMonitor');
const recoveryManager = require('./RecoveryManager');

class OperationRouter {
  constructor() {
    this.adapters = {
      [capabilityRegistry.ENGINES.BAILEYS]: baileysAdapter,
      [capabilityRegistry.ENGINES.WHATSAPP_WEB_BRIDGE]: whatsAppWebAdapter,
      [capabilityRegistry.ENGINES.CLOUD_API]: cloudAPIAdapter,
    };

    // Idempotency cache: key -> { timestamp, result }
    this.idempotencyCache = new Map();
    this.idempotencyTtlMs = 30 * 1000;
  }

  _checkIdempotency(key) {
    if (!key) return null;
    const entry = this.idempotencyCache.get(key);
    if (entry && Date.now() - entry.timestamp < this.idempotencyTtlMs) {
      return entry.result;
    }
    return null;
  }

  _saveIdempotency(key, result) {
    if (!key) return;
    this.idempotencyCache.set(key, { timestamp: Date.now(), result });
    if (this.idempotencyCache.size > 2000) {
      const first = this.idempotencyCache.keys().next().value;
      this.idempotencyCache.delete(first);
    }
  }

  /**
   * Executa uma operação através do motor ideal
   * @param {string} operation Ex: 'SEND_TEXT', 'SEND_PRODUCT', 'SEND_ORDER', 'SEND_MEDIA'
   * @param {Object} payload Dados da mensagem/operação
   * @param {Object} connectionContext Contexto da sessão, empresa e opções
   */
  async execute(operation, payload = {}, connectionContext = {}) {
    const startTime = Date.now();
    const sessionId = connectionContext.sessionId || payload.sessionId || 'main';
    const isCommercial = [
      capabilityRegistry.OPERATIONS.SEND_PRODUCT,
      capabilityRegistry.OPERATIONS.SEND_ORDER,
      capabilityRegistry.OPERATIONS.SEND_CATALOG,
    ].includes(operation);

    // 1. Verificação de Idempotência
    const idempotencyKey = connectionContext.idempotencyKey || payload.idempotencyKey || payload.requestId;
    if (idempotencyKey) {
      const cached = this._checkIdempotency(idempotencyKey);
      if (cached) {
        console.log(`[OPERATION-ROUTER] Idempotent hit for key "${idempotencyKey}". Returning cached result.`);
        return cached;
      }
    }

    // 2. Verificação de Circuit Breaker
    if (recoveryManager.isCircuitOpen(sessionId)) {
      throw new Error(`Circuit breaker is active for session "${sessionId}". Requests temporarily paused.`);
    }

    // 3. Seleção do Motor Ideal
    const selectedEngine = transportRegistry.selectEngineForOperation(sessionId, operation, connectionContext);
    if (!selectedEngine) {
      throw new Error(`No capable and connected engine found for operation "${operation}" on session "${sessionId}".`);
    }

    const adapter = this.adapters[selectedEngine];
    if (!adapter) {
      throw new Error(`Adapter for engine "${selectedEngine}" is not implemented.`);
    }

    console.log(`[OPERATION-ROUTER] Routing "${operation}" to engine [${selectedEngine}] for session "${sessionId}"`);

    // 4. Execução da Operação
    try {
      let result;
      switch (operation) {
        case capabilityRegistry.OPERATIONS.SEND_TEXT:
          result = await adapter.sendText(payload, connectionContext);
          break;
        case capabilityRegistry.OPERATIONS.SEND_MEDIA:
          result = await adapter.sendMedia(payload, connectionContext);
          break;
        case capabilityRegistry.OPERATIONS.SEND_PRODUCT:
          result = await adapter.sendProduct(payload, connectionContext);
          break;
        case capabilityRegistry.OPERATIONS.SEND_ORDER:
          result = await adapter.sendOrder(payload, connectionContext);
          break;
        case capabilityRegistry.OPERATIONS.SEND_CATALOG:
          result = await adapter.sendCatalog(payload, connectionContext);
          break;
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }

      const durationMs = Date.now() - startTime;
      healthMonitor.recordOperation(durationMs, isCommercial, true);
      recoveryManager.recordSuccess(sessionId);

      const standardEnvelope = {
        success: true,
        operation,
        engine: selectedEngine,
        whatsappMessageId: result?.whatsappMessageId || result?.key?.id || null,
        data: result,
        durationMs,
      };

      // Normaliza evento de envio no CRM
      eventNormalizer.normalizeMessageSent(selectedEngine, {
        ...payload,
        whatsappMessageId: standardEnvelope.whatsappMessageId,
      }, connectionContext);

      // Salva no cache de idempotência
      if (idempotencyKey) {
        this._saveIdempotency(idempotencyKey, standardEnvelope);
      }

      return standardEnvelope;
    } catch (err) {
      const durationMs = Date.now() - startTime;
      healthMonitor.recordOperation(durationMs, isCommercial, false);
      recoveryManager.recordFailure(sessionId, err);

      console.error(`[OPERATION-ROUTER] Error executing "${operation}" via [${selectedEngine}]:`, err.message);

      // NUNCA fazer fallback cego que possa duplicar mensagem enviada parcialmente
      throw err;
    }
  }
}

module.exports = new OperationRouter();
