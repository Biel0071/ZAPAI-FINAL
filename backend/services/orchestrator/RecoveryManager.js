'use strict';

/**
 * RecoveryManager — ZAPFLOW Unified WhatsApp Orchestrator
 * Gestão de falhas, Circuit Breaker e recuperação controlada de serviços e conexões.
 */

const sessionManager = require('../sessionManager');
const webBridgeManager = require('./WebBridgeManager');

class RecoveryManager {
  constructor() {
    this.failureCounts = new Map(); // sessionId -> count
    this.circuitBreakers = new Map(); // sessionId -> { state: 'closed' | 'open', openUntil: timestamp }
    this.maxFailuresBeforeBreak = 5;
    this.breakCooldownMs = 30 * 1000; // 30 segundos
  }

  isCircuitOpen(sessionId) {
    const sId = String(sessionId || 'default').trim().toLowerCase();
    const cb = this.circuitBreakers.get(sId);
    if (!cb) return false;

    if (cb.state === 'open') {
      if (Date.now() < cb.openUntil) {
        return true;
      }
      // Half-open transition
      cb.state = 'half-open';
      return false;
    }

    return false;
  }

  recordSuccess(sessionId) {
    const sId = String(sessionId || 'default').trim().toLowerCase();
    this.failureCounts.set(sId, 0);
    this.circuitBreakers.delete(sId);
  }

  recordFailure(sessionId, error) {
    const sId = String(sessionId || 'default').trim().toLowerCase();
    const current = (this.failureCounts.get(sId) || 0) + 1;
    this.failureCounts.set(sId, current);

    console.warn(`[RECOVERY-MANAGER] Failure #${current} recorded for session "${sId}":`, error?.message || error);

    if (current >= this.maxFailuresBeforeBreak) {
      console.error(`[RECOVERY-MANAGER] Circuit breaker TRIPPED for session "${sId}". Pausing requests for 30s.`);
      this.circuitBreakers.set(sId, {
        state: 'open',
        openUntil: Date.now() + this.breakCooldownMs,
      });

      // Dispara tentativa controlada de autocura em background
      this.attemptSessionRecovery(sId).catch(recErr => {
        console.warn(`[RECOVERY-MANAGER] Background recovery failed for "${sId}":`, recErr.message);
      });
    }
  }

  /**
   * Tenta recuperar a sessão de forma assíncrona e segura
   */
  async attemptSessionRecovery(sessionId) {
    const sId = String(sessionId || 'default').trim().toLowerCase();
    console.log(`[RECOVERY-MANAGER] Initiating controlled self-healing for session "${sId}"...`);

    // 1. Limpa possíveis navegadores WebBridge presos
    try {
      await webBridgeManager.closeSession(sId);
    } catch (_) {}

    // 2. Se Baileys estiver offline, solicita reconexão suave
    try {
      if (sessionManager.reconnectSession) {
        await sessionManager.reconnectSession(sId, { force: true });
        console.log(`[RECOVERY-MANAGER] Reconnection request sent to sessionManager for "${sId}".`);
      }
    } catch (err) {
      console.warn(`[RECOVERY-MANAGER] Could not reconnect Baileys session "${sId}":`, err.message);
    }
  }
}

module.exports = new RecoveryManager();
